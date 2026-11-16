/** 每殿人数上限（§4.3） */
export const ROOM_CAPACITY = 100;
/** 蒲团数量，10 × 10（§3） */
export const SEAT_COUNT = 100;
/** 匹配时优先选择的人数区间（§4.3） */
export const ROOM_PREFERRED_MIN = 30;
export const ROOM_PREFERRED_MAX = 90;

/** 断线后保留位置和蒲团的时长（§4.3） */
export const RECONNECT_GRACE_MS = 30_000;
/** delta 广播频率：每秒 5 次（§4.5） */
export const DELTA_INTERVAL_MS = 200;
/** 限流：每个连接每秒最多 10 条；连续超限 10 秒断开（§4.5） */
export const RATE_LIMIT_PER_SEC = 10;
export const RATE_LIMIT_KICK_AFTER_MS = 10_000;

/** 一炷香约 5 分钟（§2.1-5） */
export const INCENSE_DURATION_MS = 5 * 60_000;
/** 一盏灯亮 24 小时，文字 ≤ 30 字且只存本地（§2.1-10） */
export const LAMP_DURATION_MS = 24 * 60 * 60_000;
export const LAMP_TEXT_MAX = 30;

/** 物件交互距离，米（§2.1-4） */
export const INTERACT_RADIUS_M = 2;

/** 晨钟 07:00、暮鼓 18:30，提前 5 分钟提示（§2.1-7） */
export const BELL_TIME = { hour: 7, minute: 0 } as const;
export const DRUM_TIME = { hour: 18, minute: 30 } as const;
export const BELL_DRUM_NOTICE_MS = 5 * 60_000;

/** 昼夜切换的平滑过渡时长（§2.1-8） */
export const DAY_PHASE_TRANSITION_MS = 60_000;

export const ACTIONS = ['hezi', 'bai', 'muyu', 'nianzhu'] as const;
export type Action = (typeof ACTIONS)[number];

/**
 * 每个动作做一遍的时长。协议里只有「开始做」没有「停下」（§4.5），
 * 所以动作都是做完一遍自己收起；想继续就再点一次。
 */
export const ACTION_DURATION_MS: Record<Action, number> = {
  hezi: 4000,
  bai: 5000,
  muyu: 6000,
  nianzhu: 8000,
};

/** 走路速度，米/秒。前端按它播走路，服务器按它估算每个人此刻走到了哪里。 */
export const WALK_SPEED = 3;

/** 服务器关闭连接时用的代码 */
export const CLOSE_CODE = {
  /** 这个殿满了，客户端应重新 /join */
  roomFull: 4001,
  /** 同一个匿名 ID 在别处又连了进来 */
  replaced: 4002,
  /** 连续超频 */
  rateLimited: 4008,
} as const;

/** 时区桶的范围：UTC 偏移四舍五入到整小时（§4.3） */
export const TZ_BUCKET_MIN = -12;
export const TZ_BUCKET_MAX = 14;

/** 由 Date#getTimezoneOffset()（分钟，东区为负）得到时区桶。 */
export function tzBucket(timezoneOffsetMinutes: number): number {
  const hours = Math.round(-timezoneOffsetMinutes / 60);
  return Math.min(TZ_BUCKET_MAX, Math.max(TZ_BUCKET_MIN, hours)) + 0;
}

const ROOM_ID = /^tz(-?\d{1,2})\.(\d{1,6})$/;

export function makeRoomId(bucket: number, index: number): string {
  return `tz${bucket}.${index}`;
}

/** 解析殿的 ID；格式不对或时区越界返回 null。 */
export function parseRoomId(roomId: string): { bucket: number; index: number } | null {
  const m = ROOM_ID.exec(roomId);
  if (!m) return null;
  const bucket = Number(m[1]);
  if (bucket < TZ_BUCKET_MIN || bucket > TZ_BUCKET_MAX) return null;
  return { bucket, index: Number(m[2]) };
}
