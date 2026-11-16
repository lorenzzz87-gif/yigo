import { LAYOUT, findPath, heightAt, type Vec2 } from '@banshan/shared';

/**
 * 自己的位置和路径。每帧都在变，所以不放进 React 状态，由 useFrame 直接读写。
 */
export const player = {
  x: LAYOUT.spawn.x as number,
  z: LAYOUT.spawn.z as number,
  y: heightAt(LAYOUT.spawn.x, LAYOUT.spawn.z),
  /** 朝向，弧度；0 朝 +z，初始面向山门 */
  heading: Math.PI,
  path: [] as Vec2[],
};

/** 走路速度，米/秒 */
export const WALK_SPEED = 3;

/** 朝 (x, z) 走。目标不可走时，走到最近的可走点。 */
export function walkTo(x: number, z: number): void {
  player.path = findPath(player, { x, z });
}
