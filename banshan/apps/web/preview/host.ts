/**
 * 预览用的外层页面：在页面里跑一个真实的殿（workers/realtime 的 Room 代码），
 * 两个 iframe 各是一个完整的客户端，按真实协议通过 postMessage 和它说话。
 */
import { Room } from '../../../workers/realtime/src/Room';

type FromClient =
  | { banshan: 'open'; id: number; url: string }
  | { banshan: 'msg'; id: number; data: string }
  | { banshan: 'close'; id: number; code: number };

interface Pair {
  request: string;
  response: string;
}

interface RoomLike {
  webSocketMessage(ws: unknown, raw: string): void;
  webSocketClose(ws: unknown, code: number, reason: string, clean: boolean): void;
  alarm(): Promise<void>;
}

/** 服务器一侧的连接：Room 只用到这几个方法 */
class ServerSocket {
  private attachment: unknown = null;
  closed = false;

  constructor(
    private readonly frame: Window,
    readonly id: number,
  ) {}

  send(data: string): void {
    if (!this.closed) this.frame.postMessage({ banshan: 'msg', id: this.id, data }, '*');
  }

  close(code = 1000): void {
    if (this.closed) return;
    this.closed = true;
    this.frame.postMessage({ banshan: 'closed', id: this.id, code }, '*');
  }

  serializeAttachment(value: unknown): void {
    this.attachment = structuredClone(value);
  }

  deserializeAttachment(): unknown {
    return this.attachment;
  }
}

function createRoom(): { room: RoomLike; auto: () => Pair | null } {
  const store = new Map<string, unknown>();
  let auto: Pair | null = null;
  let alarmTimer: ReturnType<typeof setTimeout> | undefined;
  let room: RoomLike | null = null;
  const ctx = {
    storage: {
      get: async (k: string) => store.get(k),
      put: async (k: string, v: unknown) => void store.set(k, structuredClone(v)),
      delete: async (k: string) => store.delete(k),
      list: async ({ prefix }: { prefix: string }) =>
        new Map([...store].filter(([k]) => k.startsWith(prefix))),
      setAlarm: async (t: number) => {
        clearTimeout(alarmTimer);
        alarmTimer = setTimeout(() => void room?.alarm(), Math.max(0, t - Date.now()));
      },
    },
    getWebSockets: () => [],
    setWebSocketAutoResponse: (p: Pair) => (auto = p),
    blockConcurrencyWhile: async (fn: () => Promise<unknown>) => fn(),
    waitUntil: () => {},
    acceptWebSocket: () => {},
  };
  const env = {
    DIRECTORY: { idFromName: (n: string) => n, get: () => ({ report: async () => {} }) },
  };
  room = new Room(ctx as never, env as never) as unknown as RoomLike;
  return { room, auto: () => auto };
}

const rooms = new Map<string, ReturnType<typeof createRoom>>();
const sockets = new Map<Window, Map<number, { ws: ServerSocket; roomId: string }>>();

function roomFor(roomId: string) {
  let r = rooms.get(roomId);
  if (!r) rooms.set(roomId, (r = createRoom()));
  return r;
}

window.addEventListener('message', (e: MessageEvent<FromClient>) => {
  const frame = e.source as Window | null;
  if (!frame || !e.data || typeof e.data !== 'object' || !('banshan' in e.data)) return;
  let mine = sockets.get(frame);
  if (!mine) sockets.set(frame, (mine = new Map()));
  const m = e.data;

  if (m.banshan === 'open') {
    const roomId = new URL(m.url).pathname.split('/').pop() ?? '';
    const ws = new ServerSocket(frame, m.id);
    mine.set(m.id, { ws, roomId });
    frame.postMessage({ banshan: 'opened', id: m.id }, '*');
    return;
  }
  const conn = mine.get(m.id);
  if (!conn) return;
  const { room, auto } = roomFor(conn.roomId);
  if (m.banshan === 'msg') {
    const pair = auto();
    if (pair && m.data === pair.request) conn.ws.send(pair.response);
    else room.webSocketMessage(conn.ws, m.data);
  } else if (m.banshan === 'close') {
    mine.delete(m.id);
    conn.ws.closed = true;
    room.webSocketClose(conn.ws, m.code, '', m.code === 1000);
  }
});

// 「让乙断网 20 秒」按钮
const button = document.getElementById('drop') as HTMLButtonElement | null;
const lower = document.getElementById('b') as HTMLIFrameElement | null;
const DROP_MS = 20_000;
if (button && lower) {
  const label = button.textContent ?? '';
  button.addEventListener('click', () => {
    lower.contentWindow?.postMessage({ banshan: 'drop', ms: DROP_MS }, '*');
    button.disabled = true;
    const end = Date.now() + DROP_MS;
    const tick = () => {
      const left = Math.ceil((end - Date.now()) / 1000);
      if (left > 0) {
        button.textContent = `断网中，${left} 秒后恢复`;
        setTimeout(tick, 250);
      } else {
        button.textContent = label;
        button.disabled = false;
      }
    };
    tick();
  });
}
