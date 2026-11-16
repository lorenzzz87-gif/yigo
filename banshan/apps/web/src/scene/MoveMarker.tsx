import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh } from 'three';
import { heightAt } from '@banshan/shared';
import { player } from '../store/player';
import { INK } from './palette';

/** 目标点上的一圈淡墨，走到就消失。 */
export function MoveMarker() {
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const goal = player.path.at(-1);
    m.visible = goal !== undefined;
    if (goal) m.position.set(goal.x, heightAt(goal.x, goal.z) + 0.06, goal.z);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.22, 0.3, 24]} />
      <meshBasicMaterial color={INK.jiaomo} transparent opacity={0.45} depthWrite={false} />
    </mesh>
  );
}
