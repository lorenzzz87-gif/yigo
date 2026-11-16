import { ACTION_DURATION_MS, seatPosition } from '@banshan/shared';
import { describe, expect, it } from 'vitest';
import {
  actorAct,
  actorSitAt,
  actorStand,
  actorWalkTo,
  createActor,
  stepActor,
  type Actor,
} from './actor';

/** 以每帧 50 毫秒推进，直到停下 */
function settle(a: Actor, from: number): number {
  let now = from;
  for (let i = 0; i < 2000 && (a.path.length > 0 || i === 0); i++) {
    now += 50;
    stepActor(a, 0.05, now);
  }
  return now;
}

describe('actor', () => {
  it('walks to a target and stands', () => {
    const a = createActor('看云的人', 0, 33);
    expect(actorWalkTo(a, 2, 31, 1000)).toBe(true);
    stepActor(a, 0.05, 1050);
    expect(a.anim).toBe('walk');
    settle(a, 1050);
    expect(a).toMatchObject({ x: 2, z: 31, anim: 'stand' });
  });

  it('walks to a cushion, sits, and stands up when walking away', () => {
    const a = createActor('看云的人', 0, -2);
    actorSitAt(a, 4, 1000);
    expect(a.pendingSeat).toBe(4);
    const now = settle(a, 1000);
    expect(a).toMatchObject({ ...seatPosition(4), seat: 4, anim: 'sit', seated: true });
    actorWalkTo(a, 0, -2, now);
    stepActor(a, 0.05, now + 50);
    expect(a).toMatchObject({ seat: null, anim: 'walk', seated: false });
  });

  it('sits at once when an action arrives while still walking to the cushion', () => {
    const a = createActor('看云的人', 0, -2);
    actorSitAt(a, 55, 1000);
    stepActor(a, 0.05, 1050);
    expect(actorAct(a, 'bai', 1100)).toBe(true);
    stepActor(a, 0.05, 1150);
    expect(a).toMatchObject({ ...seatPosition(55), seat: 55, anim: 'bai' });
  });

  it('refuses bai while standing and stops walking for other actions', () => {
    const a = createActor('看云的人', 0, 33);
    expect(actorAct(a, 'bai', 1000)).toBe(false);
    actorWalkTo(a, 0, 20, 1000);
    stepActor(a, 0.05, 1050);
    expect(actorAct(a, 'hezi', 1100)).toBe(true);
    stepActor(a, 0.05, 1150);
    expect(a.path).toEqual([]);
    expect(a.anim).toBe('hezi');
    stepActor(a, 0.05, 1100 + ACTION_DURATION_MS.hezi);
    expect(a.anim).toBe('stand');
  });

  it('resumes an action part-way for someone who joined late', () => {
    const a = createActor('看云的人', 0, 33);
    actorAct(a, 'muyu', 10_000, 2500);
    stepActor(a, 0.05, 10_000);
    expect(a.anim).toBe('muyu');
    expect(a.animTime).toBeCloseTo(2.5);
  });

  it('stands up on request', () => {
    const a = createActor('看云的人', 0, -2);
    actorSitAt(a, 4, 1000);
    const now = settle(a, 1000);
    actorStand(a, now);
    stepActor(a, 0.05, now + 50);
    expect(a).toMatchObject({ seat: null, anim: 'stand' });
  });
});
