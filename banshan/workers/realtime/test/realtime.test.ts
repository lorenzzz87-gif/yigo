import {
  CLOSE_CODE,
  LAYOUT,
  ROOM_CAPACITY,
  parseServerMessage,
  seatPosition,
  zhCN,
  type ClientMessage,
  type ServerMessage,
} from '@banshan/shared';
import { runInDurableObject } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it } from 'vitest';

type Of<T extends ServerMessage['type']> = Extract<ServerMessage, { type: T }>;

const uuid = () => crypto.randomUUID();
let roomSeq = 0;
/** 每个测试用自己的殿。时区 2 专门留给它们，不和 Directory 的测试混用 */
const freshRoom = () => `tz2.${1000 + roomSeq++}`;

/** 测试环境同时只能开几条连接，所以每个测试结束都把自己开的关掉 */
const opened: WebSocket[] = [];
afterEach(() => {
  for (const ws of opened.splice(0)) {
    try {
      ws.close(1000);
    } catch {
      // 已经关了
    }
  }
});

/** 测试用的客户端：收到的消息都记下来，可以等某一条出现。 */
class Client {
  messages: ServerMessage[] = [];
  closed: { code: number } | null = null;
  private waiters: (() => void)[] = [];

  constructor(
    readonly ws: WebSocket,
    readonly anonId: string,
  ) {
    ws.accept();
    opened.push(ws);
    ws.addEventListener('message', (e) => {
      const msg = parseServerMessage(e.data);
      if (msg) this.messages.push(msg);
      this.wake();
    });
    ws.addEventListener('close', (e) => {
      this.closed = { code: e.code };
      this.wake();
    });
  }

  private wake() {
    this.waiters.splice(0).forEach((w) => w());
  }

  send(msg: ClientMessage) {
    this.ws.send(JSON.stringify(msg));
  }

  async until<T>(find: () => T | undefined | null | false, ms = 2000): Promise<T> {
    const deadline = Date.now() + ms;
    for (;;) {
      const found = find();
      if (found) return found;
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`timed out; got ${JSON.stringify(this.messages.slice(-3))}`);
      await Promise.race([
        new Promise<void>((r) => this.waiters.push(r)),
        new Promise((r) => setTimeout(r, Math.min(left, 50))),
      ]);
    }
  }

  next<T extends ServerMessage['type']>(type: T, from = 0): Promise<Of<T>> {
    return this.until(() => this.messages.slice(from).find((m): m is Of<T> => m.type === type));
  }

  /** 等到 delta 里出现某个人满足条件的更新 */
  update(id: string, pred: (u: NonNullable<Of<'delta'>['updated']>[number]) => boolean) {
    return this.until(() =>
      this.messages
        .flatMap((m) => (m.type === 'delta' ? (m.updated ?? []) : []))
        .find((u) => u.id === id && pred(u)),
    );
  }
}

async function open(roomId: string): Promise<WebSocket> {
  const res = await exports.default.fetch(
    new Request(`http://banshan.test/ws/${roomId}`, { headers: { Upgrade: 'websocket' } }),
  );
  expect(res.status).toBe(101);
  return res.webSocket!;
}

async function join(roomId: string, anonId = uuid(), name: string = zhCN.names[0]) {
  const client = new Client(await open(roomId), anonId);
  client.send({ type: 'hello', anonId, name });
  const snapshot = await client.next('snapshot');
  const id = snapshot.selfId;
  // 等「有人进来」这一拍广播完，之后的变化才会作为 updated 发出
  if (!snapshot.resumed) {
    await client.until(() =>
      client.messages.some((m) => m.type === 'delta' && m.joined?.some((p) => p.id === id)),
    );
  }
  return { client, snapshot, id };
}

const get = (path: string) => exports.default.fetch(new Request(`http://banshan.test${path}`));
const directory = (bucket: number) => env.DIRECTORY.get(env.DIRECTORY.idFromName(String(bucket)));

describe('routes', () => {
  it('answers /health and 404s elsewhere', async () => {
    expect((await get('/health')).status).toBe(200);
    expect((await get('/')).status).toBe(404);
  });

  it('validates /join and /ws', async () => {
    expect((await get('/join')).status).toBe(400);
    expect((await get('/join?tz=99')).status).toBe(400);
    expect((await get('/join?tz=abc')).status).toBe(400);
    expect((await get('/ws/not-a-room')).status).toBe(400);
    expect((await get('/ws/tz1.0')).status).toBe(426);
  });

  it('accepts tz written as +1, 1 or -5', async () => {
    for (const tz of ['%2B1', '+1', '1', '-5']) {
      const res = await get(`/join?tz=${tz}`);
      expect(res.status, tz).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      const { roomId } = await res.json<{ roomId: string }>();
      expect(roomId).toMatch(tz === '-5' ? /^tz-5\.\d+$/ : /^tz1\.\d+$/);
    }
  });
});

describe('Directory matching (§4.3)', () => {
  it('sends the 101st person to a new room', async () => {
    const d = directory(7);
    const first = await d.assign(7);
    for (let i = 1; i < ROOM_CAPACITY; i++) expect(await d.assign(7)).toBe(first);
    const overflow = await d.assign(7);
    expect(overflow).not.toBe(first);
    expect(await d.loads()).toEqual({ [first]: ROOM_CAPACITY, [overflow]: 1 });
  });

  it('follows reported counts: prefers 30–90, then fullest, then a new room', async () => {
    const d = directory(8);
    await d.report('tz8.50', 10);
    await d.report('tz8.51', 96);
    expect(await d.assign(8)).toBe('tz8.51');
    await d.report('tz8.52', 40);
    expect(await d.assign(8)).toBe('tz8.52');
    await d.report('tz8.50', 100);
    await d.report('tz8.51', 100);
    await d.report('tz8.52', 100);
    const fresh = await d.assign(8);
    expect(['tz8.50', 'tz8.51', 'tz8.52']).not.toContain(fresh);
  });

  it('forgets a room once it reports empty', async () => {
    const d = directory(9);
    await d.report('tz9.5', 12);
    await d.report('tz9.5', 0);
    expect(await d.loads()).toEqual({});
  });

  it('keeps time zones apart', async () => {
    const a = await (await get('/join?tz=4')).json<{ roomId: string }>();
    const b = await (await get('/join?tz=5')).json<{ roomId: string }>();
    expect(a.roomId.startsWith('tz4.')).toBe(true);
    expect(b.roomId.startsWith('tz5.')).toBe(true);
  });
});

describe('Room sync (§4.5)', () => {
  it('sends a snapshot on hello and tells others about the newcomer', async () => {
    const room = freshRoom();
    const a = await join(room);
    expect(a.snapshot.resumed).toBe(false);
    expect(a.snapshot.players).toHaveLength(1);
    const me = a.snapshot.players[0]!;
    expect(me).toMatchObject({ id: a.id, name: zhCN.names[0], seat: null, action: null });
    expect(Math.abs(me.x)).toBeLessThanOrEqual(LAYOUT.plaza.halfWidth);
    expect(JSON.stringify(a.snapshot)).not.toContain(a.client.anonId);

    const b = await join(room, uuid(), zhCN.names[1]);
    expect(b.snapshot.players.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
    const delta = await a.client.until(() =>
      a.client.messages.find((m) => m.type === 'delta' && m.joined?.some((p) => p.id === b.id)),
    );
    // 重连的人不会再被当作新来的广播一遍
    expect(a.client.messages.filter((m) => m.type === 'delta')).toHaveLength(2);
    expect(JSON.stringify(delta)).not.toContain(b.client.anonId);
  });

  it('relays moves and actions to others within the delta interval', async () => {
    const room = freshRoom();
    const a = await join(room);
    const b = await join(room);

    const sent = Date.now();
    a.client.send({ type: 'move', x: 0, z: 10 });
    const moved = await b.client.update(a.id, (u) => u.tx === 0 && u.tz === 10);
    expect(Date.now() - sent).toBeLessThan(300);

    // 接连的变化被攒成每秒最多 5 拍
    const mark = b.client.messages.length;
    for (let i = 0; i < 8; i++) {
      a.client.send({ type: 'move', x: i % 2, z: 12 });
      await new Promise((r) => setTimeout(r, 50));
    }
    await new Promise((r) => setTimeout(r, 250));
    const beats = b.client.messages.slice(mark).filter((m) => m.type === 'delta').length;
    expect(beats).toBeGreaterThanOrEqual(2);
    expect(beats).toBeLessThanOrEqual(4);
    expect(moved.seat).toBeNull();

    a.client.send({ type: 'act', action: 'muyu' });
    await b.client.update(a.id, (u) => u.action === 'muyu');
  });

  it('ignores moves outside the walkable area', async () => {
    const room = freshRoom();
    const a = await join(room);
    const b = await join(room);
    a.client.send({ type: 'move', x: 500, z: 500 });
    a.client.send({ type: 'move', x: 0, z: -22 }); // 佛台
    a.client.send({ type: 'move', x: 1, z: 32 });
    const u = await b.client.update(a.id, (m) => m.tx !== undefined);
    expect(u).toMatchObject({ tx: 1, tz: 32 });
  });

  it('only lets bai through while seated', async () => {
    const room = freshRoom();
    const a = await join(room);
    const b = await join(room);
    a.client.send({ type: 'act', action: 'bai' });
    a.client.send({ type: 'act', action: 'hezi' });
    const first = await b.client.update(a.id, (u) => u.action !== undefined);
    expect(first.action).toBe('hezi');

    a.client.send({ type: 'sit', seat: 12 });
    await a.client.next('seat_ok');
    a.client.send({ type: 'act', action: 'bai' });
    await b.client.update(a.id, (u) => u.action === 'bai');
  });

  it('gives a contested cushion to exactly one person', async () => {
    const room = freshRoom();
    const a = await join(room);
    const b = await join(room);
    a.client.send({ type: 'sit', seat: 42 });
    b.client.send({ type: 'sit', seat: 42 });
    const results = await Promise.all(
      [a, b].map((c) =>
        c.client.until(() =>
          c.client.messages.find((m) => m.type === 'seat_ok' || m.type === 'seat_taken'),
        ),
      ),
    );
    expect(results.map((r) => r.type).sort()).toEqual(['seat_ok', 'seat_taken']);

    // 坐着的人走开后，蒲团空出来
    const [winner, loser] = results[0]!.type === 'seat_ok' ? [a, b] : [b, a];
    winner.client.send({ type: 'move', x: 0, z: -2 });
    await loser.client.update(winner.id, (u) => u.seat === null && u.tx === 0);
    const before = loser.client.messages.length;
    loser.client.send({ type: 'sit', seat: 42 });
    expect((await loser.client.next('seat_ok', before)).seat).toBe(42);
  });

  it('allows one rename per connection, from the name pool only', async () => {
    const room = freshRoom();
    const a = await join(room);
    const b = await join(room);
    a.client.ws.send(JSON.stringify({ type: 'rename', name: '我自己起的名字' }));
    a.client.send({ type: 'rename', name: zhCN.names[5] });
    a.client.send({ type: 'rename', name: zhCN.names[6] });
    await b.client.update(a.id, (u) => u.name !== undefined);
    await new Promise((r) => setTimeout(r, 450));
    const names = b.client.messages
      .flatMap((m) => (m.type === 'delta' ? (m.updated ?? []) : []))
      .filter((u) => u.id === a.id && u.name)
      .map((u) => u.name);
    expect(names).toEqual([zhCN.names[5]]);
  });

  it('keeps position and cushion when the same anonId reconnects', async () => {
    const room = freshRoom();
    const a = await join(room);
    const b = await join(room);
    a.client.send({ type: 'sit', seat: 77 });
    await a.client.next('seat_ok');
    a.client.ws.close(1000);
    await new Promise((r) => setTimeout(r, 300));

    // 断线期间：别人还看得到，蒲团还占着
    const mark = b.client.messages.length;
    b.client.send({ type: 'sit', seat: 77 });
    expect((await b.client.next('seat_taken', mark)).seat).toBe(77);

    const back = await join(room, a.client.anonId);
    expect(back.snapshot.resumed).toBe(true);
    expect(back.id).toBe(a.id);
    const me = back.snapshot.players.find((p) => p.id === back.id)!;
    expect(me.seat).toBe(77);
    expect({ x: me.x, z: me.z }).toEqual(seatPosition(77));
    expect(back.snapshot.players).toHaveLength(2);
  });

  it('replaces the old connection when the same anonId connects twice', async () => {
    const room = freshRoom();
    const a = await join(room);
    const again = await join(room, a.client.anonId);
    expect(again.id).toBe(a.id);
    await a.client.until(() => a.client.closed);
    expect(a.client.closed?.code).toBe(CLOSE_CODE.replaced);
    expect(again.snapshot.players).toHaveLength(1);
  });

  it('survives malformed and oversized messages', async () => {
    const room = freshRoom();
    const a = await join(room);
    const b = await join(room);
    const junk: (string | ArrayBuffer)[] = [
      '',
      '{',
      'null',
      '[]',
      '{"type":"nope"}',
      '{"type":"move","x":"NaN","z":1}',
      '{"type":"move","x":1e999,"z":1}',
      '{"type":"sit","seat":-1}',
      '{"type":"sit","seat":100}',
      '{"type":"lamp","text":"一句话"}',
      '{"type":"hello","anonId":"x","name":"y"}',
      JSON.stringify({ type: 'stand', pad: 'x'.repeat(5000) }),
      new Uint8Array([0, 255, 1, 2]).buffer,
    ];
    // 留在限流以内，确保每条都真的被解析到
    for (const [i, raw] of junk.entries()) {
      a.client.ws.send(raw);
      if (i % 8 === 7) await new Promise((r) => setTimeout(r, 1100));
    }
    await new Promise((r) => setTimeout(r, 1100));
    a.client.send({ type: 'move', x: 2, z: 31 });
    await b.client.update(a.id, (u) => u.tx === 2);
    expect(a.client.closed).toBeNull();
  });

  it('drops messages over the rate limit without falling over', async () => {
    const room = freshRoom();
    const a = await join(room);
    const b = await join(room);
    for (let i = 0; i < 300; i++) a.client.send({ type: 'act', action: 'hezi' });
    await new Promise((r) => setTimeout(r, 1200));
    expect(a.client.closed).toBeNull();
    // 过了这一秒，又能正常说话
    a.client.send({ type: 'move', x: -2, z: 31 });
    await b.client.update(a.id, (u) => u.tx === -2);
    expect((await get('/health')).status).toBe(200);
  });

  it('ignores everything before hello', async () => {
    const room = freshRoom();
    const b = await join(room);
    const stranger = new Client(await open(room), uuid());
    stranger.send({ type: 'move', x: 0, z: 31 });
    stranger.send({ type: 'sit', seat: 3 });
    await new Promise((r) => setTimeout(r, 400));
    expect(stranger.messages).toEqual([]);
    const mark = b.client.messages.length;
    b.client.send({ type: 'sit', seat: 3 });
    await b.client.next('seat_ok', mark);
  });

  it('turns the 101st person away and reports the count to the Directory', async () => {
    const d = directory(3);
    const room = await d.assign(3);
    const first = await join(room);
    // 测试环境同时只能开几条连接，所以其余 99 人直接放进殿的状态里；
    // 真正的 101 条连接在端到端脚本里验证
    const stub = env.ROOM.get(env.ROOM.idFromName(room));
    await runInDurableObject(stub, (instance) => {
      const players = (instance as unknown as { players: Map<string, unknown> }).players;
      const template = [...players.values()][0] as { player: Record<string, unknown> };
      for (let i = 0; i < ROOM_CAPACITY - 2; i++) {
        const id = `fake${i}`;
        players.set(id, {
          player: { ...template.player, id, anonId: uuid(), seat: null },
          ws: null,
          ghostUntil: Date.now() + 60_000,
        });
      }
    });
    const hundredth = await join(room);
    expect(hundredth.snapshot.players).toHaveLength(ROOM_CAPACITY);

    const extra = new Client(await open(room), uuid());
    extra.send({ type: 'hello', anonId: extra.anonId, name: zhCN.names[0] });
    await extra.until(() => extra.closed);
    expect(extra.closed?.code).toBe(CLOSE_CODE.roomFull);
    expect(first.client.closed).toBeNull();

    // 殿已满，Directory 把下一个人分到新殿
    await new Promise((r) => setTimeout(r, 100));
    expect((await d.loads())[room]).toBe(ROOM_CAPACITY);
    const { roomId } = await (await get('/join?tz=3')).json<{ roomId: string }>();
    expect(roomId).not.toBe(room);
  });
});
