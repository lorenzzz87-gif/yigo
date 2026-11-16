// 端到端冒烟：对着一个正在跑的实时服务（默认本地 wrangler dev）用真实 WebSocket 验证
//   1. 第 101 人被分到新殿；硬闯满员的殿会被请走
//   2. 畸形消息、超频消息之后服务器照常工作
// 用法：node loadtest/smoke.mjs [http://localhost:8787] [时区桶]
// 大规模压测（1 万并发）在 M8 用 k6 做。
import { randomUUID } from 'node:crypto';

const base = process.argv[2] ?? 'http://localhost:8787';
const tz = process.argv[3] ?? '11';
const NAME = '慢步的人';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function join() {
  const res = await fetch(`${base}/join?tz=${tz}`);
  if (!res.ok) throw new Error(`join ${res.status}`);
  return (await res.json()).roomId;
}

function connect(roomId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/ws/${roomId}`);
    const c = { ws, roomId, messages: [], closed: null };
    ws.onmessage = (e) => {
      try {
        c.messages.push(JSON.parse(e.data));
      } catch {
        c.messages.push(e.data);
      }
    };
    ws.onclose = (e) => (c.closed = e.code);
    ws.onerror = () => reject(new Error('socket error'));
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'hello', anonId: randomUUID(), name: NAME }));
      resolve(c);
    };
  });
}

async function until(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await sleep(20);
  }
  throw new Error('timed out');
}

let failed = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
}

// ---------- 1. 第 101 人 ----------
const clients = [];
const rooms = new Set();
for (let i = 0; i < 100; i++) {
  const roomId = await join();
  rooms.add(roomId);
  const c = await connect(roomId);
  await until(() => c.messages.find((m) => m.type === 'snapshot'));
  clients.push(c);
}
const first = clients[0].roomId;
check('the first 100 people share one room', rooms.size === 1, [...rooms].join(', '));
const last = clients.at(-1).messages.find((m) => m.type === 'snapshot');
check('the 100th sees 100 people', last.players.length === 100, `${last.players.length}`);

await sleep(300);
const overflow = await join();
check('the 101st is sent to a new room', overflow !== first, `${first} → ${overflow}`);

const intruder = await connect(first);
await until(() => intruder.closed !== null);
check(
  'forcing into the full room is refused',
  intruder.closed === 4001,
  `close ${intruder.closed}`,
);

// ---------- 2. 畸形与超频 ----------
const [a, b] = clients;
const junk = [
  '',
  '{',
  'null',
  '[]',
  '{"type":"nope"}',
  '{"type":"sit","seat":999}',
  'x'.repeat(100_000),
];
for (const raw of junk) a.ws.send(raw);
a.ws.send(new Uint8Array([0, 255, 3]));
await sleep(1200);
a.ws.send(JSON.stringify({ type: 'move', x: 1, z: 31 }));
const moved = (c) =>
  c.messages.some((m) => m.type === 'delta' && m.updated?.some((u) => u.tx === 1));
await until(() => moved(b));
check('still relays after malformed messages', a.closed === null);

const mark = b.messages.length;
for (let i = 0; i < 2000; i++) a.ws.send(JSON.stringify({ type: 'act', action: 'hezi' }));
await sleep(1500);
const relayed = b.messages.slice(mark).filter((m) => m.type === 'delta').length;
check('a 2000-message burst is mostly dropped', relayed <= 3, `${relayed} broadcasts`);
check('the flooder is not disconnected for one burst', a.closed === null);

// 连续超频 10 秒以上：断开
const flood = setInterval(() => {
  for (let i = 0; i < 30; i++) a.ws.send(JSON.stringify({ type: 'stand' }));
}, 100);
await until(() => a.closed !== null, 15_000).catch(() => {});
clearInterval(flood);
check('flooding for over 10 s gets disconnected', a.closed === 4008, `close ${a.closed}`);

const health = await fetch(`${base}/health`);
check('server is healthy afterwards', health.ok);
b.ws.send(JSON.stringify({ type: 'move', x: -1, z: 31 }));
await until(() =>
  clients[2].messages.some((m) => m.type === 'delta' && m.updated?.some((u) => u.tx === -1)),
);
check('the room still works for everyone else', true);

for (const c of clients) c.ws.close();
await sleep(200);
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
