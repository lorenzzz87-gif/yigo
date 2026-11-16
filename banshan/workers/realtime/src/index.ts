import { ROOM_CAPACITY } from '@banshan/shared';

export { Directory } from './Directory';
export { Room } from './Room';

const WS_PATH = /^\/ws\/([A-Za-z0-9_-]{1,64})$/;

/** 路由：/join、/ws/:roomId（§4.2）。M0 只有骨架，两条业务路由在 M3 接到 DO 上。 */
export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/health') {
      return Response.json({ ok: true, roomCapacity: ROOM_CAPACITY });
    }
    if (pathname === '/join' || WS_PATH.test(pathname)) {
      return new Response('not implemented', { status: 501 });
    }
    return new Response('not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
