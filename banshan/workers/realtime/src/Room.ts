import { DurableObject } from 'cloudflare:workers';

/** 每个殿一个（§4.3、§4.6）。WebSocket 同步在 M3 实现。 */
export class Room extends DurableObject<Env> {
  override async fetch(): Promise<Response> {
    return new Response('not implemented', { status: 501 });
  }
}
