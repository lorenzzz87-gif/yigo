/**
 * 小沙弥白模的尺寸和姿势。姿势是纯函数：给出动画状态和时间，返回两臂方向、俯身角度等。
 * 正式美术到位后，这里换成骨骼动画片段，状态机不变。
 */
import { ACTION_DURATION_MS, type AnimState } from '@banshan/shared';

export type V3 = readonly [number, number, number];

/** 身体坐标系：脚底为原点，+y 向上，+z 朝前。Q 版，头身比约 1:2。 */
export const MODEL = {
  bodyHeight: 0.55,
  bodyTopRadius: 0.12,
  bodyBottomRadius: 0.26,
  headRadius: 0.23,
  /** 头心比锥顶高出多少 */
  headAbove: 0.17,
  shoulderX: 0.22,
  shoulderY: 0.46,
  armLength: 0.3,
  armRadius: 0.045,
  handRadius: 0.06,
  /** 坐下时身体压矮、底部变宽，示意盘腿 */
  sitScaleY: 0.82,
  sitScaleXZ: 1.05,
} as const;

export type Prop = 'none' | 'muyu' | 'nianzhu';

export interface Pose {
  /** 右臂、左臂的方向（单位向量，从肩指向手） */
  armR: V3;
  armL: V3;
  /** 向前俯身的角度，弧度 */
  pitch: number;
  /** 0 = 站，1 = 坐 */
  sit: number;
  /** 走路时的上下起伏 */
  lift: number;
  prop: Prop;
}

const norm = (x: number, y: number, z: number): V3 => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
};
const mirror = (v: V3): V3 => [-v[0], v[1], v[2]];
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
export const mixDir = (a: V3, b: V3, k: number): V3 =>
  norm(mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k));
const smooth = (k: number) => {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
};

// 以下方向都按右臂写，左臂取镜像
const REST = norm(0.5, -0.87, 0);
const REST_SIT = norm(0.55, -0.75, 0.35);
const HEZI = norm(-0.19, -0.02, 0.3);
const BOW_REACH = norm(0.1, 0.3, 0.95);
const HOLD = norm(-0.42, -0.28, 0.86);
const STRIKE_UP = norm(-0.3, 0.12, 0.95);
const STRIKE_DOWN = norm(-0.3, -0.2, 0.93);
const BEADS = norm(-0.13, -0.3, 0.9);

/** 礼拜时俯身的最大角度 */
export const BOW_MAX = 1.15;

/** 礼拜一遍：合十 → 俯身 → 停 → 起身 → 合十。u 为 0–1 的进度。 */
function bowAmount(u: number): number {
  if (u < 0.15) return 0;
  if (u < 0.45) return smooth((u - 0.15) / 0.3);
  if (u < 0.6) return 1;
  if (u < 0.88) return 1 - smooth((u - 0.6) / 0.28);
  return 0;
}

/**
 * 某个动画状态在 t 秒时的姿势。
 * @param seated 是否坐在蒲团上（合十、木鱼、念珠站着坐着都能做）
 * @param t 进入该状态后经过的秒数
 */
export function targetPose(anim: AnimState, seated: boolean, t: number): Pose {
  const sit = seated ? 1 : 0;
  const rest = seated ? REST_SIT : REST;
  const base: Pose = { armR: rest, armL: mirror(rest), pitch: 0, sit, lift: 0, prop: 'none' };

  switch (anim) {
    case 'stand':
    case 'sit':
      return base;
    case 'walk': {
      const swing = Math.sin(t * 8) * 0.35;
      return {
        ...base,
        armR: norm(0.5, -0.87, swing),
        armL: norm(-0.5, -0.87, -swing),
        lift: Math.abs(Math.sin(t * 8)) * 0.03,
      };
    }
    case 'hezi':
      return { ...base, armR: HEZI, armL: mirror(HEZI), pitch: 0.08 };
    case 'bai': {
      const a = bowAmount((t * 1000) / ACTION_DURATION_MS.bai);
      const arm = mixDir(HEZI, BOW_REACH, a);
      return { ...base, armR: arm, armL: mirror(arm), pitch: a * BOW_MAX };
    }
    case 'muyu': {
      // 每秒一下：快落、慢抬
      const p = t % 1;
      const down = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
      return {
        ...base,
        armR: mixDir(STRIKE_UP, STRIKE_DOWN, down),
        armL: mirror(HOLD),
        prop: 'muyu',
      };
    }
    case 'nianzhu': {
      const w = Math.sin(t * 2) * 0.04;
      return {
        ...base,
        armR: norm(BEADS[0], BEADS[1] + w, BEADS[2]),
        armL: mirror(norm(BEADS[0], BEADS[1] - w, BEADS[2])),
        prop: 'nianzhu',
      };
    }
  }
}

/** 两个姿势之间的过渡（状态切换时用）。 */
export function blendPose(a: Pose, b: Pose, k: number): Pose {
  return {
    armR: mixDir(a.armR, b.armR, k),
    armL: mixDir(a.armL, b.armL, k),
    pitch: mix(a.pitch, b.pitch, k),
    sit: mix(a.sit, b.sit, k),
    lift: mix(a.lift, b.lift, k),
    prop: b.prop,
  };
}

/** 按坐姿程度得到身体各部分的实际尺寸。 */
export function bodyMetrics(sit: number) {
  const sy = mix(1, MODEL.sitScaleY, sit);
  const sxz = mix(1, MODEL.sitScaleXZ, sit);
  const height = MODEL.bodyHeight * sy;
  return {
    sy,
    sxz,
    height,
    topRadius: MODEL.bodyTopRadius * sxz,
    bottomRadius: MODEL.bodyBottomRadius * sxz,
    shoulderX: MODEL.shoulderX,
    shoulderY: MODEL.shoulderY * sy,
    headY: height + MODEL.headAbove,
  };
}
