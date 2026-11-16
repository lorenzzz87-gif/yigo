/**
 * 预设可走区域上的寻路（§2.1-2）。区域都是凸矩形，相邻区域之间有一段「门」；
 * 路径 = 依次穿过这些门的折线，同一区域内走直线。全部是纯函数。
 */
import { REGIONS, nearestWalkable, type Vec2 } from './world';

/** 相邻两个区域共用的一段边 */
interface Portal {
  a: number;
  b: number;
  /** 门所在的轴：'z' 表示门在 z = at 这条线上，沿 x 展开 */
  axis: 'x' | 'z';
  at: number;
  lo: number;
  hi: number;
}

/** 穿门时离门框的最小距离，避免贴着墙角走 */
const PORTAL_MARGIN = 0.3;

function buildPortals(): Portal[] {
  const portals: Portal[] = [];
  for (let a = 0; a < REGIONS.length; a++) {
    for (let b = a + 1; b < REGIONS.length; b++) {
      const ra = REGIONS[a]!;
      const rb = REGIONS[b]!;
      const span = (lo: number, hi: number) => {
        const m = Math.min(PORTAL_MARGIN, (hi - lo) / 2);
        return { lo: lo + m, hi: hi - m };
      };
      const xLo = Math.max(ra.minX, rb.minX);
      const xHi = Math.min(ra.maxX, rb.maxX);
      const zLo = Math.max(ra.minZ, rb.minZ);
      const zHi = Math.min(ra.maxZ, rb.maxZ);
      if (xLo < xHi && (ra.minZ === rb.maxZ || ra.maxZ === rb.minZ)) {
        const at = ra.minZ === rb.maxZ ? ra.minZ : ra.maxZ;
        portals.push({ a, b, axis: 'z', at, ...span(xLo, xHi) });
      } else if (zLo < zHi && (ra.minX === rb.maxX || ra.maxX === rb.minX)) {
        const at = ra.minX === rb.maxX ? ra.minX : ra.maxX;
        portals.push({ a, b, axis: 'x', at, ...span(zLo, zHi) });
      }
    }
  }
  return portals;
}

const PORTALS = buildPortals();

/** 从区域 from 到区域 to 要依次穿过的门（广度优先）。不连通时返回 null。 */
function portalRoute(from: number, to: number): Portal[] | null {
  if (from === to) return [];
  const via = new Map<number, { prev: number; portal: Portal }>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const portal of PORTALS) {
      if (portal.a !== cur && portal.b !== cur) continue;
      const next = portal.a === cur ? portal.b : portal.a;
      if (seen.has(next)) continue;
      seen.add(next);
      via.set(next, { prev: cur, portal });
      queue.push(next);
    }
  }
  if (!via.has(to)) return null;
  const route: Portal[] = [];
  for (let cur = to; cur !== from;) {
    const step = via.get(cur)!;
    route.unshift(step.portal);
    cur = step.prev;
  }
  return route;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 从 cur 朝 goal 走，穿过 portal 时落在门上的哪一点。 */
function crossing(cur: Vec2, goal: Vec2, portal: Portal): Vec2 {
  const along = portal.axis === 'z' ? 'x' : 'z';
  const across = portal.axis;
  const span = goal[across] - cur[across];
  const t = span === 0 ? 1 : (portal.at - cur[across]) / span;
  const ideal = t > 0 && t <= 1 ? cur[along] + (goal[along] - cur[along]) * t : goal[along];
  const p = { x: 0, z: 0 };
  p[across] = portal.at;
  p[along] = clamp(ideal, portal.lo, portal.hi);
  return p;
}

/**
 * 从 from 走到 to 的路径点（不含起点，含终点）。
 * 起点和终点不在可走范围内时，各自取最近的可走点。
 */
export function findPath(from: Vec2, to: Vec2): Vec2[] {
  const start = nearestWalkable(from.x, from.z);
  const goal = nearestWalkable(to.x, to.z);
  const route = portalRoute(start.region, goal.region);
  if (!route) return [];

  const path: Vec2[] = [];
  let cur: Vec2 = { x: start.x, z: start.z };
  const push = (p: Vec2) => {
    if (Math.hypot(p.x - cur.x, p.z - cur.z) > 1e-6) {
      path.push(p);
      cur = p;
    }
  };
  for (const portal of route) push(crossing(cur, goal, portal));
  push({ x: goal.x, z: goal.z });
  return path;
}

/** 沿路径前进 distance 米。返回新位置、剩余路径和朝向（弧度，0 朝 +z）。 */
export function stepAlongPath(
  pos: Vec2,
  path: readonly Vec2[],
  distance: number,
): { pos: Vec2; path: Vec2[]; heading: number | null } {
  let cur = { x: pos.x, z: pos.z };
  let left = distance;
  let heading: number | null = null;
  let i = 0;
  while (i < path.length && left > 0) {
    const next = path[i]!;
    const dx = next.x - cur.x;
    const dz = next.z - cur.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-9) heading = Math.atan2(dx, dz);
    if (d <= left) {
      cur = { x: next.x, z: next.z };
      left -= d;
      i++;
    } else {
      cur = { x: cur.x + (dx / d) * left, z: cur.z + (dz / d) * left };
      left = 0;
    }
  }
  return { pos: cur, path: path.slice(i), heading };
}
