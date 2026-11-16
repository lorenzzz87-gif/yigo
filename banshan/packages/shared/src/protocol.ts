/**
 * 同步协议（§4.5）。JSON over WebSocket，前后端共用这里的 zod 结构。
 * 服务器不接收任何用户输入的文字：名字只能来自名字池，灯不带文字。
 */
import { z } from 'zod';
import { ACTIONS, SEAT_COUNT } from './constants';
import { zhCN } from './copy/zh-CN';

const NAME_POOL: ReadonlySet<string> = new Set(zhCN.names);

/** 名字必须来自名字池 */
export const PoolName = z.string().refine((n) => NAME_POOL.has(n), 'name not in pool');
export const ActionSchema = z.enum(ACTIONS);
const Seat = z
  .number()
  .int()
  .min(0)
  .max(SEAT_COUNT - 1);
const Coord = z.number().finite();

// ---------- 客户端 → 服务器 ----------

export const ClientMessage = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('hello'), anonId: z.uuid(), name: PoolName }),
  z.strictObject({ type: z.literal('move'), x: Coord, z: Coord }),
  z.strictObject({ type: z.literal('act'), action: ActionSchema }),
  z.strictObject({ type: z.literal('sit'), seat: Seat }),
  z.strictObject({ type: z.literal('stand') }),
  z.strictObject({ type: z.literal('incense') }),
  z.strictObject({ type: z.literal('lamp') }),
  z.strictObject({ type: z.literal('rename'), name: PoolName }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ---------- 服务器 → 客户端 ----------

export const PlayerState = z.object({
  /** 殿内会话 id，不是 anonId */
  id: z.string(),
  name: z.string(),
  x: z.number(),
  z: z.number(),
  seat: Seat.nullable(),
  action: ActionSchema.nullable(),
});
export type PlayerState = z.infer<typeof PlayerState>;

export const ServerMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('snapshot'),
    selfId: z.string(),
    players: z.array(PlayerState),
    incense: z.number().int().nonnegative(),
    lamps: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('delta'),
    joined: z.array(PlayerState).optional(),
    left: z.array(z.string()).optional(),
    updated: z.array(PlayerState.partial().required({ id: true })).optional(),
  }),
  z.object({ type: z.literal('seat_ok'), seat: Seat }),
  z.object({ type: z.literal('seat_taken'), seat: Seat }),
  z.object({ type: z.literal('lamps'), count: z.number().int().nonnegative() }),
  z.object({ type: z.literal('incense_count'), count: z.number().int().nonnegative() }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

/** 解析一条客户端消息；任何畸形输入都返回 null，不抛错。 */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string') return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = ClientMessage.safeParse(json);
  return result.success ? result.data : null;
}
