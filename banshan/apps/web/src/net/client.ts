import {
  CLOSE_CODE,
  PING,
  PONG,
  RECONNECT_GRACE_MS,
  parseServerMessage,
  tzBucket,
  type ClientMessage,
  type ServerMessage,
} from '@banshan/shared';

/**
 * WebSocket 客户端（§4.3、§4.5）：/join 拿到殿，连上，掉线自动重连。
 * 30 秒内重连回原来的殿，位置和蒲团都还在；超过了就重新分配。
 * 没配置实时服务地址时一直离线，场景照常可用（单人）。
 */
const BASE: string =
  import.meta.env.VITE_REALTIME_URL ??
  (import.meta.env.DEV ? `${location.protocol}//${location.hostname}:8787` : '');

const PING_INTERVAL_MS = 20_000;
const PONG_TIMEOUT_MS = 8_000;
const RETRY_DELAYS_MS = [500, 1000, 2000, 4000];

export interface NetHandlers {
  hello: () => { anonId: string; name: string };
  message: (msg: ServerMessage) => void;
}

let handlers: NetHandlers | null = null;
let ws: WebSocket | null = null;
let roomId: string | null = null;
let lostAt: number | null = null;
let attempts = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let pingTimer: ReturnType<typeof setInterval> | undefined;
let pongTimer: ReturnType<typeof setTimeout> | undefined;
let stopped = false;
/** 调试用：在这个时刻之前不重连，模拟断网 */
let blockedUntil = 0;

export const net = {
  enabled: BASE !== '',
  get connected(): boolean {
    return ws?.readyState === WebSocket.OPEN;
  },
  get roomId(): string | null {
    return roomId;
  },

  start(h: NetHandlers): void {
    if (!net.enabled || handlers) return;
    handlers = h;
    window.addEventListener('online', () => retry(0));
    window.addEventListener('offline', () => ws?.close());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !net.connected) retry(0);
    });
    void connect();
  },

  /** 发一条消息；没连上就不发（离线期间的操作只在本机生效）。 */
  send(msg: ClientMessage): boolean {
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  },

  /** 仅调试：断开并在 ms 毫秒内不重连。 */
  drop(ms: number): void {
    blockedUntil = Date.now() + ms;
    ws?.close();
    retry(ms);
  },
};

function retry(delay: number): void {
  if (stopped) return;
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void connect(), delay);
}

function scheduleRetry(): void {
  const delay = RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)]!;
  attempts++;
  retry(delay);
}

async function connect(): Promise<void> {
  if (!handlers || stopped) return;
  if (ws && ws.readyState <= WebSocket.OPEN) return;
  const wait = blockedUntil - Date.now();
  if (wait > 0) return retry(wait);

  // 断开太久，原来的位置已经不保留了：重新分配殿
  if (lostAt !== null && Date.now() - lostAt > RECONNECT_GRACE_MS) roomId = null;

  try {
    if (!roomId) {
      const tz = tzBucket(new Date().getTimezoneOffset());
      const res = await fetch(`${BASE}/join?tz=${tz}`);
      if (!res.ok) throw new Error(`join ${res.status}`);
      roomId = ((await res.json()) as { roomId: string }).roomId;
    }
  } catch {
    return scheduleRetry();
  }
  if (ws && ws.readyState <= WebSocket.OPEN) return;

  const socket = new WebSocket(`${BASE.replace(/^http/, 'ws')}/ws/${roomId}`);
  ws = socket;

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ type: 'hello', ...handlers!.hello() } satisfies ClientMessage));
    clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(PING);
      clearTimeout(pongTimer);
      // 等不到回音就当断了，主动关掉去重连
      pongTimer = setTimeout(() => socket.close(), PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  });

  socket.addEventListener('message', (e) => {
    clearTimeout(pongTimer);
    if (e.data === PONG) return;
    const msg = parseServerMessage(e.data);
    if (!msg) return;
    if (msg.type === 'snapshot') {
      attempts = 0;
      lostAt = null;
    }
    handlers?.message(msg);
  });

  socket.addEventListener('close', (e) => {
    if (ws !== socket) return;
    ws = null;
    clearInterval(pingTimer);
    clearTimeout(pongTimer);
    lostAt ??= Date.now();
    if (e.code === CLOSE_CODE.replaced) {
      // 同一个人在别的页面进来了，这一页安静地退到单人
      stopped = true;
      return;
    }
    if (e.code === CLOSE_CODE.roomFull) {
      roomId = null;
      return retry(200);
    }
    scheduleRetry();
  });
}
