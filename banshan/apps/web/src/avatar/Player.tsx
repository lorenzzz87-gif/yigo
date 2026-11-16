import { heightAt, stepAlongPath } from '@banshan/shared';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { INK } from '../scene/palette';
import { WALK_SPEED, player } from '../store/player';

const TURN_RATE = 10;

/** 自己。M1 用一个胶囊体代替，M2 换成小沙弥白模和动画状态机。 */
export function Player() {
  const ref = useRef<Group>(null);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    if (player.path.length > 0) {
      const step = stepAlongPath(player, player.path, WALK_SPEED * dt);
      player.x = step.pos.x;
      player.z = step.pos.z;
      player.path = step.path;
      if (step.heading !== null) {
        // 沿最短弧转向
        const diff = Math.atan2(
          Math.sin(step.heading - player.heading),
          Math.cos(step.heading - player.heading),
        );
        player.heading += diff * Math.min(1, TURN_RATE * dt);
      }
    }
    player.y = heightAt(player.x, player.z);
    const g = ref.current;
    if (g) {
      g.position.set(player.x, player.y, player.z);
      g.rotation.y = player.heading;
    }
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.28, 0.54, 4, 10]} />
        <meshStandardMaterial color={INK.danmo} flatShading />
      </mesh>
    </group>
  );
}
