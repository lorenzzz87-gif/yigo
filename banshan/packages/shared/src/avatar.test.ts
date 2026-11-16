import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  ACTION_DURATION_MS,
  INITIAL_AVATAR,
  animState,
  canAct,
  reduceAvatar,
  type AvatarEvent,
  type AvatarState,
} from './index';

const run = (events: [AvatarEvent, number][], from: AvatarState = INITIAL_AVATAR) =>
  events.reduce((s, [e, t]) => reduceAvatar(s, e, t), from);

describe('avatar state machine', () => {
  it('covers all seven animation states', () => {
    const seen = new Set<string>();
    let s = INITIAL_AVATAR;
    seen.add(animState(s, 0));
    s = reduceAvatar(s, { type: 'walk' }, 0);
    seen.add(animState(s, 0));
    s = reduceAvatar(s, { type: 'sit' }, 0);
    seen.add(animState(s, 0));
    for (const action of ACTIONS) {
      s = reduceAvatar(s, { type: 'act', action }, 100);
      seen.add(animState(s, 100));
    }
    expect([...seen].sort()).toEqual(
      ['bai', 'hezi', 'muyu', 'nianzhu', 'sit', 'stand', 'walk'].sort(),
    );
  });

  it('allows bai only while seated', () => {
    expect(canAct(INITIAL_AVATAR, 'bai')).toBe(false);
    const standing = run([[{ type: 'act', action: 'bai' }, 0]]);
    expect(standing).toEqual(INITIAL_AVATAR);

    const walking = run([
      [{ type: 'walk' }, 0],
      [{ type: 'act', action: 'bai' }, 10],
    ]);
    expect(animState(walking, 10)).toBe('walk');

    const seated = run([
      [{ type: 'sit' }, 0],
      [{ type: 'act', action: 'bai' }, 10],
    ]);
    expect(animState(seated, 10)).toBe('bai');
  });

  it('allows the other three actions in any posture', () => {
    for (const action of ['hezi', 'muyu', 'nianzhu'] as const) {
      expect(animState(run([[{ type: 'act', action }, 0]]), 1)).toBe(action);
      const seated = run([
        [{ type: 'sit' }, 0],
        [{ type: 'act', action }, 0],
      ]);
      expect(animState(seated, 1)).toBe(action);
      expect(seated.posture).toBe('sit');
    }
  });

  it('stops walking when an action starts', () => {
    const s = run([
      [{ type: 'walk' }, 0],
      [{ type: 'act', action: 'hezi' }, 5],
    ]);
    expect(s.posture).toBe('stand');
    expect(animState(s, 5)).toBe('hezi');
  });

  it('ends each action after one round and returns to the posture', () => {
    for (const action of ACTIONS) {
      const s = run([
        [{ type: 'sit' }, 0],
        [{ type: 'act', action }, 1000],
      ]);
      const end = 1000 + ACTION_DURATION_MS[action];
      expect(animState(s, end - 1)).toBe(action);
      expect(animState(s, end)).toBe('sit');
    }
  });

  it('restarts the round when the same action is pressed again', () => {
    const s = run([
      [{ type: 'act', action: 'muyu' }, 0],
      [{ type: 'act', action: 'muyu' }, 5000],
    ]);
    expect(animState(s, 5000 + ACTION_DURATION_MS.muyu - 1)).toBe('muyu');
  });

  it('switches directly between actions', () => {
    const s = run([
      [{ type: 'act', action: 'muyu' }, 0],
      [{ type: 'act', action: 'nianzhu' }, 500],
    ]);
    expect(animState(s, 600)).toBe('nianzhu');
  });

  it('walking drops the action and stands up from the cushion', () => {
    const s = run([
      [{ type: 'sit' }, 0],
      [{ type: 'act', action: 'nianzhu' }, 10],
      [{ type: 'walk' }, 20],
    ]);
    expect(s).toMatchObject({ posture: 'walk', action: null });
    expect(run([[{ type: 'arrive' }, 30]], s).posture).toBe('stand');
  });

  it('ignores events that do not apply', () => {
    expect(run([[{ type: 'arrive' }, 0]])).toEqual(INITIAL_AVATAR);
    expect(run([[{ type: 'stand' }, 0]])).toEqual(INITIAL_AVATAR);
    const seated = run([[{ type: 'sit' }, 0]]);
    expect(run([[{ type: 'arrive' }, 1]], seated).posture).toBe('sit');
  });
});
