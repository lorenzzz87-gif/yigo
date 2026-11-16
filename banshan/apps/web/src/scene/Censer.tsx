import { LAYOUT, TERRACE_Y } from '@banshan/shared';
import { INK } from './palette';

/** 香炉。上香在 M4 接入。 */
export function Censer() {
  const { x, z } = LAYOUT.censer;
  return (
    <group position={[x, TERRACE_Y, z]}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.3, 0.45, 0.4, 8]} />
        <meshStandardMaterial color={INK.jiaomo} flatShading />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.6, 0.4, 0.6, 8]} />
        <meshStandardMaterial color={INK.jiaomo} flatShading />
      </mesh>
    </group>
  );
}
