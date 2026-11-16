import { describe, expect, it } from 'vitest';
import {
  LAYOUT,
  REGIONS,
  SEAT_COUNT,
  TERRACE_Y,
  findPath,
  heightAt,
  nearestSeat,
  isWalkable,
  nearestWalkable,
  regionIndexAt,
  seatPosition,
  stepAlongPath,
  type Vec2,
} from './index';

/** 把折线按 5 厘米采样，确认每个采样点都在可走范围内。 */
function expectPathWalkable(from: Vec2, path: Vec2[]) {
  let cur = from;
  for (const next of path) {
    const d = Math.hypot(next.x - cur.x, next.z - cur.z);
    const n = Math.max(1, Math.ceil(d / 0.05));
    for (let i = 0; i <= n; i++) {
      const x = cur.x + ((next.x - cur.x) * i) / n;
      const z = cur.z + ((next.z - cur.z) * i) / n;
      expect(isWalkable(x, z), `(${x.toFixed(2)}, ${z.toFixed(2)})`).toBe(true);
    }
    cur = next;
  }
}

describe('world', () => {
  it('spawn is walkable and outside the gate', () => {
    expect(REGIONS[regionIndexAt(LAYOUT.spawn.x, LAYOUT.spawn.z)]?.id).toBe('plaza');
  });

  it('walls, altar and off-terrace points are not walkable', () => {
    expect(isWalkable(8, 0)).toBe(false); // 大殿前墙
    expect(isWalkable(0, -22)).toBe(false); // 佛台
    expect(isWalkable(5, 23)).toBe(false); // 石阶旁边
    expect(isWalkable(NaN, 0)).toBe(false);
    expect(isWalkable(Infinity, 0)).toBe(false);
  });

  it('height rises along the stairs and is flat elsewhere', () => {
    expect(heightAt(0, 33)).toBe(0);
    expect(heightAt(0, 28)).toBe(0);
    expect(heightAt(0, 23)).toBeCloseTo(TERRACE_Y / 2);
    expect(heightAt(0, 18)).toBe(TERRACE_Y);
    expect(heightAt(3, -10)).toBe(TERRACE_Y);
  });

  it('has 100 distinct seats, all inside the hall', () => {
    const seen = new Set<string>();
    for (let s = 0; s < SEAT_COUNT; s++) {
      const p = seatPosition(s);
      expect(REGIONS[regionIndexAt(p.x, p.z)]?.id).toBe('hall');
      seen.add(`${p.x},${p.z}`);
    }
    expect(seen.size).toBe(SEAT_COUNT);
    expect(() => seatPosition(100)).toThrow(RangeError);
    expect(() => seatPosition(-1)).toThrow(RangeError);
  });

  it('snaps outside points to the nearest walkable point', () => {
    const p = nearestWalkable(0, -30);
    expect(p).toMatchObject({ x: 0, z: -19.5 });
    expect(isWalkable(p.x, p.z)).toBe(true);
  });
});

describe('nearestSeat', () => {
  it('finds the cushion you are standing next to', () => {
    for (const seat of [0, 9, 45, 90, 99]) {
      const p = seatPosition(seat);
      expect(nearestSeat(p.x + 0.3, p.z - 0.4, 2)).toBe(seat);
    }
  });

  it('returns null when no cushion is within reach', () => {
    expect(nearestSeat(0, 10, 2)).toBeNull();
    expect(nearestSeat(11.5, -1, 2)).toBeNull();
    expect(nearestSeat(0, -1.9, 2)).toBeNull();
    expect(nearestSeat(0.8, -2.1, 2)).not.toBeNull();
  });
});

describe('findPath', () => {
  it('goes straight inside one region', () => {
    expect(findPath({ x: -5, z: 10 }, { x: 8, z: 3 })).toEqual([{ x: 8, z: 3 }]);
  });

  it('walks from the gate into the hall without leaving the walkable area', () => {
    const from = LAYOUT.spawn;
    const to = seatPosition(57);
    const path = findPath(from, to);
    expect(path.at(-1)).toEqual(to);
    expectPathWalkable(from, path);
  });

  it('stays walkable for many random pairs, in both directions', () => {
    let seed = 42;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
    const randomPoint = (): Vec2 => {
      const r = REGIONS[Math.floor(rand() * REGIONS.length)]!;
      return {
        x: r.minX + rand() * (r.maxX - r.minX),
        z: r.minZ + rand() * (r.maxZ - r.minZ),
      };
    };
    for (let i = 0; i < 500; i++) {
      const a = randomPoint();
      const b = randomPoint();
      const path = findPath(a, b);
      if (a.x !== b.x || a.z !== b.z) expect(path.at(-1)).toEqual(b);
      expectPathWalkable(a, path);
    }
  });

  it('clamps an unreachable target to the nearest walkable point', () => {
    const path = findPath({ x: 0, z: -5 }, { x: 0, z: -40 });
    expect(path).toEqual([{ x: 0, z: -19.5 }]);
  });

  it('returns an empty path when already there', () => {
    expect(findPath({ x: 1, z: 1 }, { x: 1, z: 1 })).toEqual([]);
  });
});

describe('stepAlongPath', () => {
  const path = [
    { x: 0, z: 3 },
    { x: 4, z: 3 },
  ];

  it('advances part of a segment and reports heading', () => {
    const r = stepAlongPath({ x: 0, z: 0 }, path, 1);
    expect(r.pos).toEqual({ x: 0, z: 1 });
    expect(r.path).toHaveLength(2);
    expect(r.heading).toBeCloseTo(0);
  });

  it('carries leftover distance around a corner', () => {
    const r = stepAlongPath({ x: 0, z: 0 }, path, 5);
    expect(r.pos.x).toBeCloseTo(2);
    expect(r.pos.z).toBeCloseTo(3);
    expect(r.path).toEqual([{ x: 4, z: 3 }]);
    expect(r.heading).toBeCloseTo(Math.PI / 2);
  });

  it('stops exactly at the end', () => {
    const r = stepAlongPath({ x: 0, z: 0 }, path, 100);
    expect(r.pos).toEqual({ x: 4, z: 3 });
    expect(r.path).toEqual([]);
  });

  it('does nothing with an empty path', () => {
    const r = stepAlongPath({ x: 1, z: 2 }, [], 3);
    expect(r).toEqual({ pos: { x: 1, z: 2 }, path: [], heading: null });
  });
});
