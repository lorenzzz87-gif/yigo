/**
 * 预览用，在 iframe 里、应用代码之前运行：
 * 把发往 loopback 的 /join 和 WebSocket 接到外层页面上跑的殿，不连外网。
 * 另外让 localStorage 不可用，这样两个画面各有各的匿名身份（应用会退回到内存里记）。
 */
type FromHost =
  | { banshan: 'opened'; id: number }
  | { banshan: 'msg'; id: number; data: string }
  | { banshan: 'closed'; id: number; code: number }
  | { banshan: 'drop'; ms: number };

const host = window.parent;
const sockets = new Map<number, LoopSocket>();
let seq = 0;
let offlineUntil = 0;

class LoopSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readyState = 0;
  readonly id = ++seq;

  constructor(readonly url: string) {
    super();
    sockets.set(this.id, this);
    if (Date.now() < offlineUntil) {
      // 断网中：连不上
      setTimeout(() => this.finish(1006), 50);
      return;
    }
    host.postMessage({ banshan: 'open', id: this.id, url }, '*');
  }

  send(data: string): void {
    if (this.readyState !== 1) return;
    host.postMessage({ banshan: 'msg', id: this.id, data }, '*');
  }

  close(code = 1000): void {
    if (this.readyState >= 2) return;
    this.readyState = 2;
    host.postMessage({ banshan: 'close', id: this.id, code }, '*');
    this.finish(code);
  }

  finish(code: number): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    sockets.delete(this.id);
    this.dispatchEvent(new CloseEvent('close', { code, wasClean: code === 1000 }));
  }

  opened(): void {
    if (this.readyState !== 0) return;
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }

  receive(data: string): void {
    if (this.readyState === 1) this.dispatchEvent(new MessageEvent('message', { data }));
  }
}

window.addEventListener('message', (e: MessageEvent<FromHost>) => {
  if (e.source !== host || !e.data || typeof e.data !== 'object') return;
  const m = e.data;
  if (m.banshan === 'drop') {
    offlineUntil = Date.now() + m.ms;
    for (const s of [...sockets.values()]) {
      host.postMessage({ banshan: 'close', id: s.id, code: 1006 }, '*');
      s.finish(1006);
    }
    return;
  }
  const s = sockets.get(m.id);
  if (!s) return;
  if (m.banshan === 'opened') s.opened();
  else if (m.banshan === 'msg') s.receive(m.data);
  else if (m.banshan === 'closed') s.finish(m.code);
});

Object.assign(window, { WebSocket: LoopSocket });

const realFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.hostname === 'loopback' && url.pathname === '/join') {
    if (Date.now() < offlineUntil) return Promise.reject(new TypeError('offline'));
    const tz = Number((url.searchParams.get('tz') ?? '0').trim()) || 0;
    return Promise.resolve(Response.json({ roomId: `tz${tz}.0` }));
  }
  return realFetch(input, init);
};

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  get() {
    throw new DOMException('disabled in preview', 'SecurityError');
  },
});
