import type { PlayerState, PlayerUpdate } from '@banshan/shared';
import {
  actorAct,
  actorPlaceOnSeat,
  actorSitAt,
  actorStand,
  actorWalkTo,
  createActor,
  type Actor,
} from '../avatar/actor';
import { useAppStore } from '../store';

/** 殿里的其他人。按服务器给的会话 id 索引。 */
export const remotes = new Map<string, Actor>();

function publishIds(): void {
  useAppStore.getState().setRemoteIds([...remotes.keys()]);
}

/** 第一次见到某个人：直接放到服务器说的位置和状态上。 */
function spawn(state: PlayerState, now: number): Actor {
  const a = createActor(state.name, state.x, state.z);
  if (state.seat !== null) actorPlaceOnSeat(a, state.seat, now);
  else if (state.tx !== undefined && state.tz !== undefined) {
    actorWalkTo(a, state.tx, state.tz, now);
  }
  if (state.action) actorAct(a, state.action, now, state.actionElapsed ?? 0);
  return a;
}

/** 已经在画面里的人：从他现在显示的位置接着走，不瞬移。 */
function apply(a: Actor, u: PlayerUpdate, now: number): void {
  if (u.name !== undefined) a.name = u.name;
  if (typeof u.seat === 'number') actorSitAt(a, u.seat, now);
  else if (u.tx !== undefined && u.tz !== undefined) actorWalkTo(a, u.tx, u.tz, now);
  else if (u.seat === null && (a.seat !== null || a.pendingSeat !== null)) actorStand(a, now);
  if (u.action) actorAct(a, u.action, now, u.actionElapsed ?? 0);
}

export function applySnapshot(players: readonly PlayerState[], selfId: string, now: number): void {
  const seen = new Set<string>();
  for (const p of players) {
    if (p.id === selfId) continue;
    seen.add(p.id);
    const existing = remotes.get(p.id);
    if (existing) apply(existing, p, now);
    else remotes.set(p.id, spawn(p, now));
  }
  for (const id of remotes.keys()) if (!seen.has(id)) remotes.delete(id);
  publishIds();
}

export function applyDelta(
  delta: { joined?: PlayerState[]; left?: string[]; updated?: PlayerUpdate[] },
  selfId: string,
  now: number,
): void {
  let changed = false;
  for (const p of delta.joined ?? []) {
    if (p.id === selfId) continue;
    const existing = remotes.get(p.id);
    if (existing) apply(existing, p, now);
    else {
      remotes.set(p.id, spawn(p, now));
      changed = true;
    }
  }
  for (const u of delta.updated ?? []) {
    if (u.id === selfId) continue;
    const a = remotes.get(u.id);
    if (a) apply(a, u, now);
  }
  for (const id of delta.left ?? []) changed = remotes.delete(id) || changed;
  if (changed) publishIds();
}

export function clearRemotes(): void {
  remotes.clear();
  publishIds();
}
