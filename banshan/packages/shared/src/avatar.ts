/**
 * 小沙弥的动作状态机（§2.1-3，M2）。纯函数：前端用它驱动动画，服务器用它裁决动作是否合法。
 * 七个动画状态 = 三种姿态（站、走、坐）+ 四个身体动作（合十、礼拜、木鱼、念珠）。
 */
import { ACTION_DURATION_MS, type Action } from './constants';

export type Posture = 'stand' | 'walk' | 'sit';
export type AnimState = Posture | Action;

export interface AvatarState {
  posture: Posture;
  action: Action | null;
  /** 当前动作开始的时间戳（毫秒）；没有动作时无意义 */
  actionStartedAt: number;
}

export type AvatarEvent =
  | { type: 'walk' }
  | { type: 'arrive' }
  | { type: 'sit' }
  | { type: 'stand' }
  | { type: 'act'; action: Action };

export const INITIAL_AVATAR: AvatarState = { posture: 'stand', action: null, actionStartedAt: 0 };

/** 礼拜只能坐在蒲团上做，其余随时可做。 */
export function canAct(state: AvatarState, action: Action): boolean {
  return action !== 'bai' || state.posture === 'sit';
}

/** 动作做完一遍就收起。 */
export function expire(state: AvatarState, now: number): AvatarState {
  if (state.action && now - state.actionStartedAt >= ACTION_DURATION_MS[state.action]) {
    return { ...state, action: null };
  }
  return state;
}

export function reduceAvatar(prev: AvatarState, event: AvatarEvent, now: number): AvatarState {
  const state = expire(prev, now);
  switch (event.type) {
    case 'walk':
      // 迈步就起身，手上的动作也放下
      return { posture: 'walk', action: null, actionStartedAt: 0 };
    case 'arrive':
      return state.posture === 'walk' ? { ...state, posture: 'stand' } : state;
    case 'sit':
      return { posture: 'sit', action: null, actionStartedAt: 0 };
    case 'stand':
      return state.posture === 'sit'
        ? { posture: 'stand', action: null, actionStartedAt: 0 }
        : state;
    case 'act':
      if (!canAct(state, event.action)) return state;
      // 走着的时候做动作：先停下
      return {
        posture: state.posture === 'walk' ? 'stand' : state.posture,
        action: event.action,
        actionStartedAt: now,
      };
  }
}

/** 此刻该播哪个动画。 */
export function animState(state: AvatarState, now: number): AnimState {
  const s = expire(state, now);
  return s.action ?? s.posture;
}
