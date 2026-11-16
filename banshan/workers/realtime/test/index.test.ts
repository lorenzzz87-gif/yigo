import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

const get = (path: string) => exports.default.fetch(new Request(`http://banshan.test${path}`));

describe('realtime worker skeleton', () => {
  it('answers /health', async () => {
    const res = await get('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, roomCapacity: 100 });
  });

  it('reserves /join and /ws/:roomId for M3', async () => {
    expect((await get('/join?tz=+1')).status).toBe(501);
    expect((await get('/ws/room-1')).status).toBe(501);
  });

  it('returns 404 elsewhere', async () => {
    expect((await get('/')).status).toBe(404);
    expect((await get('/ws/')).status).toBe(404);
  });

  it('binds both Durable Objects', async () => {
    for (const ns of [env.DIRECTORY, env.ROOM]) {
      const res = await ns.get(ns.idFromName('t')).fetch('http://do/');
      expect(res.status).toBe(501);
    }
  });
});
