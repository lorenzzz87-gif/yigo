import {
  INITIAL_AVATAR,
  WALK_SPEED,
  animState,
  canAct,
  expire,
  findPath,
  heightAt,
  reduceAvatar,
  seatPosition,
  stepAlongPath,
  type Action,
  type AnimState,
  type AvatarState,
  type Vec2,
} from '@banshan/shared';

/**
 * 殿里的一个人（自己或别人）在本机上的样子：位置、路径、动作状态。
 * 每帧都在变，所以是普通可变对象，由 useFrame 直接读写。
 * 自己和别人走同一套逻辑：服务器只转发目标点和动作，走路由每台机器各自插值（§4.5）。
 */
export interface Actor {
  name: string;
  x: number;
  y: number;
  z: number;
  /** 朝向，弧度；0 朝 +z */
  heading: number;
  path: Vec2[];
  avatar: AvatarState;
  /** 正坐着的蒲团 */
  seat: number | null;
  /** 正走过去准备坐下的蒲团 */
  pendingSeat: number | null;
  // 以下由 stepActor 每帧更新，供 Avatar 读取
  anim: AnimState;
  animSince: number;
  animTime: number;
  seated: boolean;
}

/** 坐下后面朝佛像（-z 方向） */
const SEATED_HEADING = Math.PI;
const TURN_RATE = 10;

export function createActor(name: string, x: number, z: number): Actor {
  return {
    name,
    x,
    z,
    y: heightAt(x, z),
    heading: Math.PI,
    path: [],
    avatar: INITIAL_AVATAR,
    seat: null,
    pendingSeat: null,
    anim: 'stand',
    animSince: 0,
    animTime: 0,
    seated: false,
  };
}

/** 朝 (x, z) 走；坐着的话先起身。已经在那里时返回 false。 */
export function actorWalkTo(a: Actor, x: number, z: number, now: number): boolean {
  const path = findPath(a, { x, z });
  if (path.length === 0) return false;
  a.path = path;
  a.seat = null;
  a.pendingSeat = null;
  a.avatar = reduceAvatar(a.avatar, { type: 'walk' }, now);
  return true;
}

/** 直接坐到蒲团上（不走过去）。 */
export function actorPlaceOnSeat(a: Actor, seat: number, now: number): void {
  const p = seatPosition(seat);
  a.x = p.x;
  a.z = p.z;
  a.path = [];
  a.seat = seat;
  a.pendingSeat = null;
  if (a.avatar.posture !== 'sit') a.avatar = reduceAvatar(a.avatar, { type: 'sit' }, now);
}

/** 走到蒲团并坐下。 */
export function actorSitAt(a: Actor, seat: number, now: number): void {
  if (a.seat === seat) return;
  const p = seatPosition(seat);
  if (actorWalkTo(a, p.x, p.z, now)) a.pendingSeat = seat;
  else actorPlaceOnSeat(a, seat, now);
}

export function actorStand(a: Actor, now: number): void {
  a.seat = null;
  a.pendingSeat = null;
  a.avatar = reduceAvatar(a.avatar, { type: 'stand' }, now);
}

/** 做一个动作；走着的时候先停下。elapsed：这个动作已经做了多久（进殿时补上）。 */
export function actorAct(a: Actor, action: Action, now: number, elapsed = 0): boolean {
  // 还在走向蒲团：服务器已经当他坐下了，直接落座再做
  if (a.pendingSeat !== null) actorPlaceOnSeat(a, a.pendingSeat, now);
  if (!canAct(a.avatar, action)) return false;
  a.path = [];
  a.avatar = reduceAvatar(a.avatar, { type: 'act', action }, now - elapsed);
  return true;
}

function turnToward(a: Actor, target: number, dt: number): void {
  // 沿最短弧转向
  const diff = Math.atan2(Math.sin(target - a.heading), Math.cos(target - a.heading));
  a.heading += diff * Math.min(1, TURN_RATE * dt);
}

/** 推进一帧：走路、到达、收起做完的动作、算出此刻的动画状态。 */
export function stepActor(a: Actor, dt: number, now: number): void {
  if (a.path.length > 0) {
    const step = stepAlongPath(a, a.path, WALK_SPEED * dt);
    a.x = step.pos.x;
    a.z = step.pos.z;
    a.path = step.path;
    if (step.heading !== null) turnToward(a, step.heading, dt);
    if (a.path.length === 0) {
      if (a.pendingSeat !== null) actorPlaceOnSeat(a, a.pendingSeat, now);
      else a.avatar = reduceAvatar(a.avatar, { type: 'arrive' }, now);
    }
  } else if (a.seat !== null) {
    turnToward(a, SEATED_HEADING, dt);
  }

  a.avatar = expire(a.avatar, now);
  a.y = heightAt(a.x, a.z);
  a.seated = a.avatar.posture === 'sit';

  const state = animState(a.avatar, now);
  if (state !== a.anim || a.animSince === 0) {
    a.anim = state;
    // 动作从它真正开始的时刻算起，这样晚进殿的人看到的进度也对
    a.animSince = a.avatar.action ? a.avatar.actionStartedAt : now;
  }
  a.animTime = (now - a.animSince) / 1000;
}
