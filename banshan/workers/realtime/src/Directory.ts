import { DurableObject } from 'cloudflare:workers';

/** 每个时区桶一个，管理该时区的殿（§4.3）。匹配逻辑在 M3 实现。 */
export class Directory extends DurableObject<Env> {
  override async fetch(): Promise<Response> {
    return new Response('not implemented', { status: 501 });
  }
}
