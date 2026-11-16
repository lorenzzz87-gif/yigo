import { ACTION_DURATION_MS, SEAT_HEIGHT, type AnimState } from '@banshan/shared';
import { describe, expect, it } from 'vitest';
import { MODEL, blendPose, bodyMetrics, targetPose, type Pose, type V3 } from './pose';

/** 允许的贴合误差：1 厘米以内的接触不算穿模 */
const EPS = 0.01;

/** 检查一个姿势：手和前臂不进身体、不进头，俯身时头和手不进地面。返回穿模的描述。 */
function clipping(pose: Pose): string[] {
  const m = bodyMetrics(pose.sit);
  const problems: string[] = [];
  const coneRadius = (y: number) =>
    m.topRadius + (m.bottomRadius - m.topRadius) * (1 - y / m.height);
  // 身体随坐姿程度抬到蒲团上，所以地面相对脚底在下方
  const groundY = -SEAT_HEIGHT * pose.sit;
  const toWorld = ([x, y, z]: V3): V3 => [
    x,
    y * Math.cos(pose.pitch) - z * Math.sin(pose.pitch),
    y * Math.sin(pose.pitch) + z * Math.cos(pose.pitch),
  ];

  const head: V3 = [0, m.headY, 0];
  if (toWorld(head)[1] - MODEL.headRadius < groundY - EPS) problems.push('head in ground');

  for (const [name, dir, side] of [
    ['R', pose.armR, 1],
    ['L', pose.armL, -1],
  ] as const) {
    const at = (len: number): V3 => [
      side * m.shoulderX + dir[0] * len,
      m.shoulderY + dir[1] * len,
      dir[2] * len,
    ];
    for (const [part, p, r] of [
      ['hand', at(MODEL.armLength), MODEL.handRadius],
      ['forearm', at(MODEL.armLength * 0.6), MODEL.armRadius],
    ] as const) {
      const radial = Math.hypot(p[0], p[2]);
      if (p[1] >= 0 && p[1] <= m.height && radial < coneRadius(p[1]) + r - EPS) {
        problems.push(`${part}${name} in body`);
      }
      const dHead = Math.hypot(p[0] - head[0], p[1] - head[1], p[2] - head[2]);
      if (dHead < MODEL.headRadius + r - EPS) problems.push(`${part}${name} in head`);
      if (toWorld(p)[1] - r < groundY - EPS) problems.push(`${part}${name} in ground`);
    }
  }
  return problems;
}

/** 每个状态在各种时刻、站和坐两种姿态下的采样 */
function samples(): { label: string; pose: Pose; seated: boolean }[] {
  const out: { label: string; pose: Pose; seated: boolean }[] = [];
  const add = (anim: AnimState, seated: boolean, duration: number) => {
    for (let i = 0; i <= 40; i++) {
      const t = (duration * i) / 40;
      out.push({
        label: `${anim}${seated ? '(sit)' : ''}@${t.toFixed(2)}`,
        pose: targetPose(anim, seated, t),
        seated,
      });
    }
  };
  add('stand', false, 1);
  add('walk', false, 2);
  add('sit', true, 1);
  for (const anim of ['hezi', 'muyu', 'nianzhu'] as const) {
    add(anim, false, ACTION_DURATION_MS[anim] / 1000);
    add(anim, true, ACTION_DURATION_MS[anim] / 1000);
  }
  add('bai', true, ACTION_DURATION_MS.bai / 1000);
  return out;
}

describe('avatar poses', () => {
  const all = samples();

  it('never clip in any of the seven states', () => {
    for (const s of all) expect(clipping(s.pose), s.label).toEqual([]);
  });

  it('never clip while blending between any two states', () => {
    // 每个状态取几个有代表性的时刻，两两过渡
    const keys = all.filter((_, i) => i % 8 === 0);
    for (const a of keys) {
      for (const b of keys) {
        for (const k of [0.25, 0.5, 0.75]) {
          const pose = blendPose(a.pose, b.pose, k);
          expect(clipping(pose), `${a.label} → ${b.label} @${k}`).toEqual([]);
        }
      }
    }
  });

  it('bows fully and comes back up within one round', () => {
    const dur = ACTION_DURATION_MS.bai / 1000;
    expect(targetPose('bai', true, 0).pitch).toBe(0);
    expect(targetPose('bai', true, dur * 0.5).pitch).toBeGreaterThan(1);
    expect(targetPose('bai', true, dur).pitch).toBe(0);
  });

  it('shows the right prop for each action', () => {
    expect(targetPose('muyu', false, 0.3).prop).toBe('muyu');
    expect(targetPose('nianzhu', true, 0.3).prop).toBe('nianzhu');
    expect(targetPose('hezi', true, 0.3).prop).toBe('none');
    expect(targetPose('walk', false, 0.3).prop).toBe('none');
  });
});
