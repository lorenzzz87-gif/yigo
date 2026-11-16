import { makeRoomId } from '@banshan/shared';
import { DurableObject } from 'cloudflare:workers';
import { chooseRoom } from './matching';

/** 分配了但人还没连上殿的名额，保留这么久 */
const RESERVATION_MS = 15_000;

interface Stored {
  counts: Record<string, number>;
  nextIndex: number;
}

/** 每个时区桶一个，管理该时区的殿（§4.3）。只存各殿人数（§4.6）。 */
export class Directory extends DurableObject<Env> {
  /** 各殿上报的人数 */
  private counts = new Map<string, number>();
  /** 各殿已分配、尚未上报的名额（时间戳） */
  private reserved = new Map<string, number[]>();
  private nextIndex = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<Stored>('state');
      if (stored) {
        this.counts = new Map(Object.entries(stored.counts));
        this.nextIndex = stored.nextIndex;
      }
    });
  }

  private save(): void {
    void this.ctx.storage.put<Stored>('state', {
      counts: Object.fromEntries(this.counts),
      nextIndex: this.nextIndex,
    });
  }

  private liveReservations(roomId: string, now: number): number[] {
    const live = (this.reserved.get(roomId) ?? []).filter((t) => now - t < RESERVATION_MS);
    if (live.length > 0) this.reserved.set(roomId, live);
    else this.reserved.delete(roomId);
    return live;
  }

  /** 给一个新来的人分配殿，返回 roomId。 */
  assign(bucket: number): string {
    const now = Date.now();
    const ids = new Set([...this.counts.keys(), ...this.reserved.keys()]);
    const loads = [...ids].map((id) => ({
      id,
      count: (this.counts.get(id) ?? 0) + this.liveReservations(id, now).length,
    }));
    let roomId = chooseRoom(loads.filter((l) => l.count > 0));
    if (roomId === null) {
      roomId = makeRoomId(bucket, this.nextIndex++);
      this.save();
    }
    this.reserved.set(roomId, [...(this.reserved.get(roomId) ?? []), now]);
    return roomId;
  }

  /** 殿每次有人进出都来报告当前人数。 */
  report(roomId: string, count: number): void {
    const before = this.counts.get(roomId) ?? 0;
    if (count > 0) this.counts.set(roomId, count);
    else this.counts.delete(roomId);
    // 新到的人兑现了之前的预留
    const arrived = Math.max(0, count - before);
    const live = this.liveReservations(roomId, Date.now()).slice(arrived);
    if (live.length > 0) this.reserved.set(roomId, live);
    else this.reserved.delete(roomId);
    this.save();
  }

  /** 各殿当前人数（含预留），调试和测试用。 */
  loads(): Record<string, number> {
    const now = Date.now();
    const ids = new Set([...this.counts.keys(), ...this.reserved.keys()]);
    return Object.fromEntries(
      [...ids].map((id) => [
        id,
        (this.counts.get(id) ?? 0) + this.liveReservations(id, now).length,
      ]),
    );
  }
}
