import {
  ACTION_DURATION_MS,
  CLOSE_CODE,
  DELTA_INTERVAL_MS,
  LAYOUT,
  PING,
  PONG,
  RECONNECT_GRACE_MS,
  ROOM_CAPACITY,
  WALK_SPEED,
  canAct,
  findPath,
  isWalkable,
  parseClientMessage,
  parseRoomId,
  seatPosition,
  stepAlongPath,
  type Action,
  type ClientMessage,
  type PlayerState,
  type PlayerUpdate,
  type ServerMessage,
} from '@banshan/shared';
import { DurableObject } from 'cloudflare:workers';
import { RateLimiter } from './rateLimit';

/** 一个人在殿里的状态。随 WebSocket 一起保存，殿休眠后能恢复。 */
interface Player {
  id: string;
  anonId: string;
  name: string;
  /** movedAt 时刻所在的位置 */
  x: number;
  z: number;
  /** 正走向的目标；null 表示没在走 */
  tx: number | null;
  tz: number | null;
  movedAt: number;
  seat: number | null;
  action: Action | null;
  actionAt: number;
  renamed: boolean;
}

interface Entry {
  player: Player;
  /** null：断线了，位置和蒲团保留到 ghostUntil（§4.3） */
  ws: WebSocket | null;
  ghostUntil: number;
}

interface Ghost {
  player: Player;
  until: number;
}

const ghostKey = (anonId: string) => `ghost:${anonId}`;

/** 每个殿一个（§4.3、§4.5、§4.6）。 */
export class Room extends DurableObject<Env> {
  private players = new Map<string, Entry>();
  private limiters = new WeakMap<WebSocket, RateLimiter>();
  private roomId: string | null = null;

  private pendingJoined = new Set<string>();
  private pendingLeft = new Set<string>();
  private pendingUpdated = new Map<string, PlayerUpdate>();
  private flushScheduled = false;
  private lastFlushAt = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    // 从休眠中醒来：在线的人从各自的连接上恢复，断线保留中的人从存储恢复
    for (const ws of ctx.getWebSockets()) {
      const player = ws.deserializeAttachment() as Player | null;
      if (player) this.players.set(player.id, { player, ws, ghostUntil: 0 });
    }
    void ctx.blockConcurrencyWhile(async () => {
      this.roomId = (await ctx.storage.get<string>('roomId')) ?? null;
      const ghosts = await ctx.storage.list<Ghost>({ prefix: ghostKey('') });
      for (const { player, until } of ghosts.values()) {
        if (!this.players.has(player.id)) {
          this.players.set(player.id, { player, ws: null, ghostUntil: until });
        }
      }
    });
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const roomId = new URL(request.url).pathname.split('/').pop() ?? '';
    if (!parseRoomId(roomId)) return new Response('bad room', { status: 400 });
    if (this.roomId !== roomId) {
      this.roomId = roomId;
      await this.ctx.storage.put('roomId', roomId);
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---------- 连接事件 ----------

  override webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    let limiter = this.limiters.get(ws);
    if (!limiter) this.limiters.set(ws, (limiter = new RateLimiter()));
    const verdict = limiter.check(Date.now());
    if (verdict === 'kick') {
      ws.close(CLOSE_CODE.rateLimited, 'rate limited');
      return;
    }
    if (verdict === 'drop') return;

    const msg = parseClientMessage(raw);
    if (!msg) return;

    const self = ws.deserializeAttachment() as Player | null;
    if (msg.type === 'hello') {
      if (!self) this.onHello(ws, msg.anonId, msg.name);
      return;
    }
    const entry = self ? this.players.get(self.id) : undefined;
    if (!entry || entry.ws !== ws) return;
    this.onMessage(entry, msg);
    ws.serializeAttachment(entry.player);
  }

  override webSocketClose(ws: WebSocket, code: number): void {
    // 回一个关闭帧把握手做完，连接才真正释放
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code);
    } catch {
      // 已经关了
    }
    this.onDisconnect(ws);
  }

  override webSocketError(ws: WebSocket): void {
    this.onDisconnect(ws);
  }

  override async alarm(): Promise<void> {
    const now = Date.now();
    let removed = false;
    for (const [id, entry] of this.players) {
      if (entry.ws === null && entry.ghostUntil <= now) {
        this.players.delete(id);
        void this.ctx.storage.delete(ghostKey(entry.player.anonId));
        this.pendingJoined.delete(id);
        this.pendingUpdated.delete(id);
        this.pendingLeft.add(id);
        removed = true;
      }
    }
    if (removed) {
      this.scheduleFlush();
      this.reportCount();
    }
    this.scheduleAlarm();
  }

  // ---------- 消息处理 ----------

  private onHello(ws: WebSocket, anonId: string, name: string): void {
    const now = Date.now();
    let entry = [...this.players.values()].find((e) => e.player.anonId === anonId);
    const resumed = entry !== undefined;

    if (entry) {
      // 30 秒内回来，或者同一个人又开了一个页面：接着用原来的位置和蒲团
      const old = entry.ws;
      entry.ws = ws;
      entry.ghostUntil = 0;
      void this.ctx.storage.delete(ghostKey(anonId));
      if (old && old !== ws) old.close(CLOSE_CODE.replaced, 'replaced');
    } else {
      if (this.players.size >= ROOM_CAPACITY) {
        ws.close(CLOSE_CODE.roomFull, 'room full');
        return;
      }
      // 在山门外随机散开一点，免得叠在一起
      const { halfWidth, minZ, maxZ } = LAYOUT.plaza;
      const player: Player = {
        id: crypto.randomUUID().slice(0, 8),
        anonId,
        name,
        x: (Math.random() * 2 - 1) * (halfWidth - 1.5),
        z: minZ + 1 + Math.random() * (maxZ - minZ - 2),
        tx: null,
        tz: null,
        movedAt: now,
        seat: null,
        action: null,
        actionAt: 0,
        renamed: false,
      };
      entry = { player, ws, ghostUntil: 0 };
      this.players.set(player.id, entry);
      this.pendingLeft.delete(player.id);
      this.pendingJoined.add(player.id);
      this.scheduleFlush();
      this.reportCount();
    }

    ws.serializeAttachment(entry.player);
    this.send(ws, {
      type: 'snapshot',
      selfId: entry.player.id,
      resumed,
      players: [...this.players.values()].map((e) => this.toWire(e.player, now)),
      incense: 0,
      lamps: 0,
    });
  }

  private onMessage(entry: Entry, msg: Exclude<ClientMessage, { type: 'hello' }>): void {
    const p = entry.player;
    const now = Date.now();
    switch (msg.type) {
      case 'move': {
        if (!isWalkable(msg.x, msg.z)) return;
        this.settle(p, now);
        p.tx = msg.x;
        p.tz = msg.z;
        p.seat = null;
        p.action = null;
        this.update(p.id, { x: p.x, z: p.z, tx: p.tx, tz: p.tz, seat: null, action: null });
        return;
      }
      case 'sit': {
        const taken = [...this.players.values()].some(
          (e) => e.player.seat === msg.seat && e.player.id !== p.id,
        );
        if (taken) {
          if (entry.ws) this.send(entry.ws, { type: 'seat_taken', seat: msg.seat });
          return;
        }
        const at = seatPosition(msg.seat);
        p.x = at.x;
        p.z = at.z;
        p.tx = null;
        p.tz = null;
        p.movedAt = now;
        p.seat = msg.seat;
        p.action = null;
        if (entry.ws) this.send(entry.ws, { type: 'seat_ok', seat: msg.seat });
        this.update(p.id, { seat: msg.seat, action: null });
        return;
      }
      case 'stand': {
        if (p.seat === null) return;
        p.seat = null;
        p.action = null;
        this.update(p.id, { seat: null, action: null });
        return;
      }
      case 'act': {
        const posture = p.seat !== null ? 'sit' : 'stand';
        if (!canAct({ posture, action: null, actionStartedAt: 0 }, msg.action)) return;
        // 走着的时候做动作：先停下
        this.settle(p, now);
        p.tx = null;
        p.tz = null;
        p.action = msg.action;
        p.actionAt = now;
        this.update(p.id, { action: msg.action });
        return;
      }
      case 'rename': {
        if (p.renamed) return;
        p.renamed = true;
        p.name = msg.name;
        this.update(p.id, { name: msg.name });
        return;
      }
      case 'incense':
      case 'lamp':
        // M4、M6 接入
        return;
    }
  }

  private onDisconnect(ws: WebSocket): void {
    const self = ws.deserializeAttachment() as Player | null;
    const entry = self ? this.players.get(self.id) : undefined;
    // 被新连接顶替的旧连接不算断线
    if (!entry || entry.ws !== ws) return;
    const now = Date.now();
    this.settle(entry.player, now);
    entry.ws = null;
    entry.ghostUntil = now + RECONNECT_GRACE_MS;
    void this.ctx.storage.put<Ghost>(ghostKey(entry.player.anonId), {
      player: entry.player,
      until: entry.ghostUntil,
    });
    this.scheduleAlarm();
  }

  // ---------- 状态与广播 ----------

  /** 把位置推进到 now：沿路径按走路速度走过这段时间。 */
  private settle(p: Player, now: number): void {
    if (p.tx !== null && p.tz !== null) {
      const path = findPath(p, { x: p.tx, z: p.tz });
      const step = stepAlongPath(p, path, (WALK_SPEED * (now - p.movedAt)) / 1000);
      p.x = step.pos.x;
      p.z = step.pos.z;
      if (step.path.length === 0) {
        p.tx = null;
        p.tz = null;
      }
    }
    p.movedAt = now;
  }

  private toWire(p: Player, now: number): PlayerState {
    this.settle(p, now);
    const elapsed = now - p.actionAt;
    const acting = p.action !== null && elapsed < ACTION_DURATION_MS[p.action];
    return {
      id: p.id,
      name: p.name,
      x: p.x,
      z: p.z,
      ...(p.tx !== null && p.tz !== null ? { tx: p.tx, tz: p.tz } : {}),
      seat: p.seat,
      action: acting ? p.action : null,
      ...(acting ? { actionElapsed: elapsed } : {}),
    };
  }

  private update(id: string, patch: Omit<PlayerUpdate, 'id'>): void {
    this.pendingUpdated.set(id, { ...this.pendingUpdated.get(id), ...patch, id });
    this.scheduleFlush();
  }

  /**
   * 每秒最多广播 5 次，只发变化（§4.5）。
   * 殿里安静时变化马上发出去，接连有变化时才攒到下一拍，所以延迟通常远小于 200 毫秒。
   */
  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    const wait = Math.max(0, this.lastFlushAt + DELTA_INTERVAL_MS - Date.now());
    setTimeout(() => this.flush(), wait);
  }

  private flush(): void {
    this.flushScheduled = false;
    const now = Date.now();
    this.lastFlushAt = now;
    const joined = [...this.pendingJoined]
      .map((id) => this.players.get(id))
      .filter((e) => e !== undefined)
      .map((e) => this.toWire(e.player, now));
    const left = [...this.pendingLeft];
    const updated = [...this.pendingUpdated.values()].filter(
      (u) => !this.pendingJoined.has(u.id) && this.players.has(u.id),
    );
    this.pendingJoined.clear();
    this.pendingLeft.clear();
    this.pendingUpdated.clear();
    if (joined.length + left.length + updated.length === 0) return;

    const payload = JSON.stringify({
      type: 'delta',
      ...(joined.length ? { joined } : {}),
      ...(left.length ? { left } : {}),
      ...(updated.length ? { updated } : {}),
    } satisfies ServerMessage);
    for (const entry of this.players.values()) {
      try {
        entry.ws?.send(payload);
      } catch {
        // 连接正在关闭，随后会收到 close 事件
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // 同上
    }
  }

  private scheduleAlarm(): void {
    let next = Infinity;
    for (const entry of this.players.values()) {
      if (entry.ws === null) next = Math.min(next, entry.ghostUntil);
    }
    if (next !== Infinity) void this.ctx.storage.setAlarm(next);
  }

  /** 每次有人进出都向 Directory 报告人数（§4.3）。 */
  private reportCount(): void {
    const parsed = this.roomId ? parseRoomId(this.roomId) : null;
    if (!parsed || !this.roomId) return;
    const directory = this.env.DIRECTORY.get(this.env.DIRECTORY.idFromName(String(parsed.bucket)));
    this.ctx.waitUntil(directory.report(this.roomId, this.players.size));
  }
}
