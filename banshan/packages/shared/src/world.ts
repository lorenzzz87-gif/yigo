/**
 * 山寺的平面布局（单位：米）。前端按它摆白模，服务器按它校验目标点（§4.5）。
 * 路线沿 -z 方向：山门外 → 山门 → 石阶 → 庭院 → 殿门 → 大殿。
 */
import { SEAT_COUNT } from './constants';

export interface Vec2 {
  x: number;
  z: number;
}

/** 一块可走的矩形。地面高度沿 z 线性变化（只有石阶不是平的）。 */
export interface Region {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** z = maxZ 处的地面高度 */
  yAtMaxZ: number;
  /** z = minZ 处的地面高度 */
  yAtMinZ: number;
}

/** 庭院和大殿所在台地的高度 */
export const TERRACE_Y = 4;

export const LAYOUT = {
  plaza: { halfWidth: 6, minZ: 30, maxZ: 36 },
  gate: { z: 29, openingHalfWidth: 2.1, height: 4.5 },
  stairs: { halfWidth: 2.5, minZ: 18, maxZ: 28, steps: 20 },
  courtyard: { halfWidth: 13.5, minZ: 0, maxZ: 18 },
  hall: {
    halfWidth: 12,
    frontZ: 0,
    backZ: -24,
    wallHeight: 6,
    wallThickness: 0.5,
    doorHalfWidth: 2.5,
    doorHeight: 3.6,
  },
  altar: { halfWidth: 5, minZ: -23.75, maxZ: -21, height: 1 },
  buddha: { x: 0, z: -22.4 },
  censer: { x: 0, z: -20.4 },
  donationBox: { x: 4.5, z: -20.4 },
  seats: { cols: 10, spacing: 1.6, firstRowZ: -4 },
  spawn: { x: 0, z: 33 },
} as const;

export const REGIONS: readonly Region[] = [
  { id: 'plaza', minX: -6, maxX: 6, minZ: 30, maxZ: 36, yAtMaxZ: 0, yAtMinZ: 0 },
  { id: 'gateway', minX: -1.8, maxX: 1.8, minZ: 28, maxZ: 30, yAtMaxZ: 0, yAtMinZ: 0 },
  { id: 'stairs', minX: -2.5, maxX: 2.5, minZ: 18, maxZ: 28, yAtMaxZ: 0, yAtMinZ: TERRACE_Y },
  {
    id: 'courtyard',
    minX: -13,
    maxX: 13,
    minZ: 0.5,
    maxZ: 18,
    yAtMaxZ: TERRACE_Y,
    yAtMinZ: TERRACE_Y,
  },
  {
    id: 'doorway',
    minX: -2,
    maxX: 2,
    minZ: -0.5,
    maxZ: 0.5,
    yAtMaxZ: TERRACE_Y,
    yAtMinZ: TERRACE_Y,
  },
  {
    id: 'hall',
    minX: -11.5,
    maxX: 11.5,
    minZ: -19.5,
    maxZ: -0.5,
    yAtMaxZ: TERRACE_Y,
    yAtMinZ: TERRACE_Y,
  },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function contains(r: Region, x: number, z: number): boolean {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

export function regionIndexAt(x: number, z: number): number {
  return REGIONS.findIndex((r) => contains(r, x, z));
}

export function isWalkable(x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && regionIndexAt(x, z) !== -1;
}

/** 离 (x, z) 最近的可走点及其所在区域。 */
export function nearestWalkable(x: number, z: number): Vec2 & { region: number } {
  let best = { x: 0, z: 0, region: 0 };
  let bestD = Infinity;
  REGIONS.forEach((r, i) => {
    const px = clamp(x, r.minX, r.maxX);
    const pz = clamp(z, r.minZ, r.maxZ);
    const d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = { x: px, z: pz, region: i };
    }
  });
  return best;
}

/** 地面高度。可走范围外取最近可走点的高度。 */
export function heightAt(x: number, z: number): number {
  const p = nearestWalkable(x, z);
  const r = REGIONS[p.region]!;
  const t = (r.maxZ - p.z) / (r.maxZ - r.minZ);
  return r.yAtMaxZ + (r.yAtMinZ - r.yAtMaxZ) * t;
}

/** 第 seat 个蒲团的位置：10 × 10，第 0 排离殿门最近。 */
export function seatPosition(seat: number): Vec2 {
  if (!Number.isInteger(seat) || seat < 0 || seat >= SEAT_COUNT) {
    throw new RangeError(`seat out of range: ${seat}`);
  }
  const { cols, spacing, firstRowZ } = LAYOUT.seats;
  const col = seat % cols;
  const row = Math.floor(seat / cols);
  return { x: (col - (cols - 1) / 2) * spacing, z: firstRowZ - row * spacing };
}

/** 蒲团顶面比地面高出的高度 */
export const SEAT_HEIGHT = 0.14;

/** (x, z) 周围 radius 米内最近的蒲团；没有则返回 null。 */
export function nearestSeat(x: number, z: number, radius: number): number | null {
  const { cols, spacing, firstRowZ } = LAYOUT.seats;
  const rows = SEAT_COUNT / cols;
  const col = Math.min(cols - 1, Math.max(0, Math.round(x / spacing + (cols - 1) / 2)));
  const row = Math.min(rows - 1, Math.max(0, Math.round((firstRowZ - z) / spacing)));
  const seat = row * cols + col;
  const p = seatPosition(seat);
  return Math.hypot(p.x - x, p.z - z) <= radius ? seat : null;
}
