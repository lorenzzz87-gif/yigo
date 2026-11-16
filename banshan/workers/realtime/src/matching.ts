import { ROOM_CAPACITY, ROOM_PREFERRED_MAX, ROOM_PREFERRED_MIN } from '@banshan/shared';

export interface RoomLoad {
  id: string;
  count: number;
}

/**
 * 给新来的人挑一个殿（§4.3）：
 * 1. 优先选 30–90 人的殿，不冷清也不拥挤（有多个时选人多的，让人聚在一起）；
 * 2. 没有就选人数最多但未满的；
 * 3. 都满了返回 null，由调用方新开一个。
 */
export function chooseRoom(rooms: readonly RoomLoad[]): string | null {
  const byCountDesc = (a: RoomLoad, b: RoomLoad) => b.count - a.count || a.id.localeCompare(b.id);
  const open = rooms.filter((r) => r.count < ROOM_CAPACITY).sort(byCountDesc);
  const preferred = open.find(
    (r) => r.count >= ROOM_PREFERRED_MIN && r.count <= ROOM_PREFERRED_MAX,
  );
  return (preferred ?? open[0])?.id ?? null;
}
