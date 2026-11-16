/**
 * 预览用：在浏览器里替代 'cloudflare:workers'，让殿（Room）的真实代码能在页面里跑。
 * 只实现 Room 用到的那一点点。
 */
export class DurableObject<E = unknown> {
  constructor(
    protected ctx: unknown,
    protected env: E,
  ) {}
}

class WebSocketRequestResponsePair {
  constructor(
    readonly request: string,
    readonly response: string,
  ) {}
}

Object.assign(globalThis, { WebSocketRequestResponsePair });
