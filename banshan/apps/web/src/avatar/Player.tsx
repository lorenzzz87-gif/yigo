import {
  INTERACT_RADIUS_M,
  expire,
  heightAt,
  nearestSeat,
  reduceAvatar,
  stepAlongPath,
} from '@banshan/shared';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useAppStore } from '../store';
import {
  SEATED_HEADING,
  WALK_SPEED,
  arriveAtSeat,
  currentAnim,
  player,
  setAvatar,
} from '../store/player';
import { Avatar } from './Avatar';

const TURN_RATE = 10;

function turnToward(target: number, dt: number): void {
  // 沿最短弧转向
  const diff = Math.atan2(Math.sin(target - player.heading), Math.cos(target - player.heading));
  player.heading += diff * Math.min(1, TURN_RATE * dt);
}

/** 自己：每帧推进走路、收起做完的动作，再交给 Avatar 去画。 */
export function Player() {
  const anim = useRef({ state: player.anim, since: performance.now() });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const now = performance.now();

    if (player.path.length > 0) {
      const step = stepAlongPath(player, player.path, WALK_SPEED * dt);
      player.x = step.pos.x;
      player.z = step.pos.z;
      player.path = step.path;
      if (step.heading !== null) turnToward(step.heading, dt);
      if (player.path.length === 0) {
        if (player.pendingSeat !== null) arriveAtSeat(player.pendingSeat);
        else setAvatar(reduceAvatar(player.avatar, { type: 'arrive' }, now));
      }
    } else if (player.seat !== null) {
      turnToward(SEATED_HEADING, dt);
    }

    const expired = expire(player.avatar, now);
    if (expired !== player.avatar) setAvatar(expired);

    player.y = heightAt(player.x, player.z);
    player.seated = player.avatar.posture === 'sit';

    const state = currentAnim(now);
    if (state !== anim.current.state) anim.current = { state, since: now };
    player.anim = state;
    player.animTime = (now - anim.current.since) / 1000;

    const near = player.seated ? null : nearestSeat(player.x, player.z, INTERACT_RADIUS_M);
    const store = useAppStore.getState();
    if (store.nearSeat !== near) store.setNearSeat(near);
  });

  return <Avatar source={player} />;
}
