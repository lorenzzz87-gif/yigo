import { TZ_BUCKET_MAX, TZ_BUCKET_MIN, parseRoomId } from '@banshan/shared';

export { Directory } from './Directory';
export { Room } from './Room';

const CORS = { 'Access-Control-Allow-Origin': '*' };

/** 路由：/join、/ws/:roomId（§4.2、§4.3）。 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true });
    }

    if (url.pathname === '/join') {
      // URL 里的 "+1" 会被解码成空格，所以两种都认
      const raw = (url.searchParams.get('tz') ?? '').trim();
      const bucket = /^[+-]?\d{1,2}$/.test(raw) ? Number(raw) : NaN;
      if (!(bucket >= TZ_BUCKET_MIN && bucket <= TZ_BUCKET_MAX)) {
        return Response.json({ error: 'bad tz' }, { status: 400, headers: CORS });
      }
      const directory = env.DIRECTORY.get(env.DIRECTORY.idFromName(String(bucket)));
      const roomId = await directory.assign(bucket);
      return Response.json({ roomId }, { headers: { ...CORS, 'Cache-Control': 'no-store' } });
    }

    const ws = /^\/ws\/([^/]+)$/.exec(url.pathname);
    if (ws) {
      const roomId = ws[1]!;
      if (!parseRoomId(roomId)) return new Response('bad room', { status: 400 });
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('expected websocket', { status: 426 });
      }
      return env.ROOM.get(env.ROOM.idFromName(roomId)).fetch(request);
    }

    return new Response('not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
