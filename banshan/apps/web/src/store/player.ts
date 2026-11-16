import {
  INITIAL_AVATAR,
  LAYOUT,
  animState,
  canAct,
  findPath,
  heightAt,
  reduceAvatar,
  seatPosition,
  type Action,
  type AnimState,
  type AvatarState,
  type Vec2,
} from '@banshan/shared';
import { useAppStore } from './index';

/**
 * 自己的位置、路径和动作。每帧都在变，所以不放进 React 状态，由 useFrame 直接读写；
 * 界面需要的那一小部分（姿态、动作）变化时同步到 zustand。
 */
export const player = {
  x: LAYOUT.spawn.x as number,
  z: LAYOUT.spawn.z as number,
  y: heightAt(LAYOUT.spawn.x, LAYOUT.spawn.z),
  /** 朝向，弧度；0 朝 +z，初始面向山门 */
  heading: Math.PI,
  path: [] as Vec2[],
  avatar: INITIAL_AVATAR as AvatarState,
  /** 正坐着的蒲团 */
  seat: null as number | null,
  /** 正走过去准备坐下的蒲团 */
  pendingSeat: null as number | null,
  // 以下由 Player 每帧更新，供 Avatar 读取
  anim: 'stand' as AnimState,
  seated: false,
  animTime: 0,
};

/** 走路速度，米/秒 */
export const WALK_SPEED = 3;
/** 坐下后面朝佛像（-z 方向） */
export const SEATED_HEADING = Math.PI;

function publish(): void {
  const { posture, action } = player.avatar;
  const s = useAppStore.getState();
  if (s.posture !== posture || s.action !== action) s.setAvatar(posture, action);
}

export function setAvatar(next: AvatarState): void {
  player.avatar = next;
  publish();
}

/** 朝 (x, z) 走。目标不可走时，走到最近的可走点。坐着的话先起身。 */
export function walkTo(x: number, z: number): void {
  const path = findPath(player, { x, z });
  if (path.length === 0) return;
  player.path = path;
  player.seat = null;
  player.pendingSeat = null;
  setAvatar(reduceAvatar(player.avatar, { type: 'walk' }, performance.now()));
}

/** 走到某个蒲团并坐下。 */
export function sitAt(seat: number): void {
  const p = seatPosition(seat);
  walkTo(p.x, p.z);
  if (player.path.length === 0) {
    // 已经站在蒲团上
    arriveAtSeat(seat);
  } else {
    player.pendingSeat = seat;
  }
}

export function arriveAtSeat(seat: number): void {
  const p = seatPosition(seat);
  player.x = p.x;
  player.z = p.z;
  player.path = [];
  player.seat = seat;
  player.pendingSeat = null;
  setAvatar(reduceAvatar(player.avatar, { type: 'sit' }, performance.now()));
}

/** 做一个身体动作。礼拜只在坐着时有效；走着的时候会先停下。 */
export function doAction(action: Action): void {
  const now = performance.now();
  if (!canAct(player.avatar, action)) return;
  player.path = [];
  player.pendingSeat = null;
  setAvatar(reduceAvatar(player.avatar, { type: 'act', action }, now));
}

export function currentAnim(now: number): AnimState {
  return animState(player.avatar, now);
}
