import { LAYOUT, type Action } from '@banshan/shared';
import {
  actorAct,
  actorPlaceOnSeat,
  actorSitAt,
  actorStand,
  actorWalkTo,
  createActor,
} from '../avatar/actor';
import { net } from '../net/client';
import { getName } from '../net/identity';
import { useAppStore } from './index';

/**
 * 自己。位置和动作每帧都在变，不放进 React 状态；
 * 界面需要的那一小部分（姿态、动作）变化时同步到 zustand。
 * 每个操作先在本机生效，再告诉服务器；离线时只在本机生效。
 */
export const player = createActor(getName(), LAYOUT.spawn.x, LAYOUT.spawn.z);

/** 已经向服务器请求、还没得到答复的蒲团 */
let requestedSeat: number | null = null;

/** 把姿态和动作同步给界面。 */
export function publishAvatar(): void {
  const { posture, action } = player.avatar;
  const s = useAppStore.getState();
  if (s.posture !== posture || s.action !== action) s.setAvatar(posture, action);
}

/** 朝 (x, z) 走。目标不可走时，走到最近的可走点。坐着的话先起身。 */
export function walkTo(x: number, z: number): void {
  requestedSeat = null;
  if (!actorWalkTo(player, x, z, performance.now())) return;
  const goal = player.path.at(-1)!;
  net.send({ type: 'move', x: goal.x, z: goal.z });
  publishAvatar();
}

/** 请求坐到某个蒲团。在线时由服务器裁决（§4.5）；离线时直接坐。 */
export function sitAt(seat: number): void {
  if (net.send({ type: 'sit', seat })) {
    requestedSeat = seat;
  } else {
    actorSitAt(player, seat, performance.now());
    publishAvatar();
  }
}

/** 服务器答应了：走过去坐下。 */
export function onSeatOk(seat: number): void {
  if (player.seat === seat) return;
  if (requestedSeat !== seat) {
    // 等答复的时候已经走开了，把蒲团还回去
    net.send({ type: 'stand' });
    return;
  }
  requestedSeat = null;
  actorSitAt(player, seat, performance.now());
  publishAvatar();
}

/** 服务器说这个蒲团有人了。 */
export function onSeatTaken(seat: number): void {
  if (requestedSeat === seat) requestedSeat = null;
  if (player.seat === seat || player.pendingSeat === seat) {
    actorStand(player, performance.now());
    player.path = [];
    publishAvatar();
  }
}

/** 做一个身体动作。礼拜只在坐着时有效；走着的时候会先停下。 */
export function doAction(action: Action): void {
  if (!actorAct(player, action, performance.now())) return;
  net.send({ type: 'act', action });
  publishAvatar();
}

/** 把自己放到服务器记着的位置上（刚进殿，或 30 秒内重连）。 */
export function adoptServerState(state: { x: number; z: number; seat: number | null }): void {
  const now = performance.now();
  requestedSeat = null;
  player.path = [];
  if (state.seat !== null) {
    actorPlaceOnSeat(player, state.seat, now);
  } else {
    if (player.seat !== null || player.pendingSeat !== null) actorStand(player, now);
    player.x = state.x;
    player.z = state.z;
  }
  publishAvatar();
}

/** 断开太久、服务器已经不记得自己了：留在原地，把现在的状态重新告诉服务器。 */
export function reannounce(): void {
  if (player.seat !== null) {
    requestedSeat = player.seat;
    net.send({ type: 'sit', seat: player.seat });
  } else {
    const goal = player.path.at(-1) ?? player;
    net.send({ type: 'move', x: goal.x, z: goal.z });
  }
}
