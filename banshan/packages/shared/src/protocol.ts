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
  /** 服务器估算的当前位置 */
  x: z.number(),
  z: z.number(),
  /** 正在走向的目标点；站着或坐着时没有 */
  tx: z.number().optional(),
  tz: z.number().optional(),
  seat: Seat.nullable(),
  action: ActionSchema.nullable(),
  /** 当前动作已经做了多久（毫秒），只在 snapshot 里有 */
  actionElapsed: z.number().nonnegative().optional(),
});
export type PlayerState = z.infer<typeof PlayerState>;

export const PlayerUpdate = PlayerState.partial().required({ id: true });
export type PlayerUpdate = z.infer<typeof PlayerUpdate>;

export const ServerMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('snapshot'),
    selfId: z.string(),
    /** true：30 秒内带同一个匿名 ID 重连，位置和蒲团都还在 */
    resumed: z.boolean(),
    players: z.array(PlayerState),
    incense: z.number().int().nonnegative(),
    lamps: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('delta'),
    joined: z.array(PlayerState).optional(),
    left: z.array(z.string()).optional(),
    updated: z.array(PlayerUpdate).optional(),
  }),
  z.object({ type: z.literal('seat_ok'), seat: Seat }),
  z.object({ type: z.literal('seat_taken'), seat: Seat }),
  z.object({ type: z.literal('lamps'), count: z.number().int().nonnegative() }),
  z.object({ type: z.literal('incense_count'), count: z.number().int().nonnegative() }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

/** 保活：客户端发 ping，服务器自动回 pong，不唤醒殿。 */
export const PING = 'ping';
export const PONG = 'pong';

/** 单条消息的长度上限（字符）。合法消息远小于它。 */
export const MAX_MESSAGE_LENGTH = 256;

/** 解析一条客户端消息；任何畸形输入都返回 null，不抛错。 */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_LENGTH) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = ClientMessage.safeParse(json);
  return result.success ? result.data : null;
}

/** 解析一条服务器消息；格式不对返回 null。 */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== 'string') return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = ServerMessage.safeParse(json);
  return result.success ? result.data : null;
}
