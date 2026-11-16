import { LAYOUT, TERRACE_Y } from '@banshan/shared';
import { Box } from './primitives';
import { INK } from './palette';

const H = LAYOUT.hall;
const WALL = '#ddd7ca';
const midZ = (H.frontZ + H.backZ) / 2;
const depth = H.frontZ - H.backZ;
const wallY = TERRACE_Y + H.wallHeight / 2;
const top = TERRACE_Y + H.wallHeight;
const frontSegment = H.halfWidth - H.doorHalfWidth + H.wallThickness / 2;

/** 一尊原创的低多边形石像：莲座、身、头，石头本色。 */
function Buddha() {
  const { x, z } = LAYOUT.buddha;
  const y = TERRACE_Y + LAYOUT.altar.height;
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[1.5, 1.7, 0.4, 8]} />
        <meshStandardMaterial color={INK.danmo} flatShading />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.7, 1.4, 2, 6]} />
        <meshStandardMaterial color={INK.danmo} flatShading />
      </mesh>
      <mesh position={[0, 2.95, 0]}>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color={INK.danmo} flatShading />
      </mesh>
    </group>
  );
}

/** 大殿：四面墙（前墙留门）、天花、屋顶、佛台和佛像。 */
export function Hall() {
  const A = LAYOUT.altar;
  return (
    <group>
      <Box
        at={[0, wallY, H.backZ]}
        size={[H.halfWidth * 2 + H.wallThickness, H.wallHeight, H.wallThickness]}
        color={WALL}
      />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box
            at={[s * H.halfWidth, wallY, midZ]}
            size={[H.wallThickness, H.wallHeight, depth + H.wallThickness]}
            color={WALL}
          />
          <Box
            at={[s * (H.doorHalfWidth + frontSegment / 2), wallY, H.frontZ]}
            size={[frontSegment, H.wallHeight, H.wallThickness]}
            color={WALL}
          />
          <Box
            at={[s * (H.doorHalfWidth - 0.15), TERRACE_Y + H.doorHeight / 2, H.frontZ]}
            size={[0.3, H.doorHeight, H.wallThickness + 0.2]}
            color={INK.jiaomo}
          />
        </group>
      ))}
      <Box
        at={[0, TERRACE_Y + (H.doorHeight + H.wallHeight) / 2, H.frontZ]}
        size={[H.doorHalfWidth * 2, H.wallHeight - H.doorHeight, H.wallThickness]}
        color={WALL}
      />
      {/* 天花挡住镜头，屋顶只管好看 */}
      <Box
        at={[0, top + 0.15, midZ]}
        size={[H.halfWidth * 2 + 1, 0.3, depth + 1]}
        color={INK.wuhui}
      />
      <mesh position={[0, top + 0.3 + 2.5, midZ]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[19.8, 5, 4, 1]} />
        <meshStandardMaterial color={INK.jiaomo} flatShading />
      </mesh>
      <mesh position={[0, TERRACE_Y + 0.02, midZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[H.halfWidth * 2 - H.wallThickness, depth - H.wallThickness]} />
        <meshStandardMaterial color="#d3cdbf" />
      </mesh>
      <Box
        at={[0, TERRACE_Y + A.height / 2, (A.minZ + A.maxZ) / 2]}
        size={[A.halfWidth * 2, A.height, A.maxZ - A.minZ]}
        color="#6f6a5e"
      />
      <Buddha />
    </group>
  );
}
