import { LAYOUT, TERRACE_Y } from '@banshan/shared';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import { useAppStore } from '../store';
import { walkTo } from '../store/player';
import { cameraState } from './cameraState';
import { Censer } from './Censer';
import { Cushions } from './Cushions';
import { DonationBox } from './DonationBox';
import { Hall } from './Hall';
import { INK } from './palette';
import { Box, Instances, type Instance } from './primitives';
import { sceneRefs } from './refs';

const S = LAYOUT.stairs;
const C = LAYOUT.courtyard;
const G = LAYOUT.gate;

/** 石阶：每级一个实例，从地面一直垫到踏面。 */
const STEPS: Instance[] = Array.from({ length: S.steps }, (_, i) => {
  const run = (S.maxZ - S.minZ) / S.steps;
  const topY = (TERRACE_Y / S.steps) * (i + 0.5);
  return {
    position: [0, topY / 2, S.maxZ - run * (i + 0.5)],
    scale: [S.halfWidth * 2, topY, run],
  };
});

/** 拖动超过这么多像素就不算点击 */
const CLICK_SLOP_PX = 8;

function Gate() {
  const pillarX = G.openingHalfWidth + 0.3;
  const wallFrom = pillarX + 0.3;
  const wallTo = 9;
  return (
    <group position={[0, 0, G.z]}>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box at={[s * pillarX, G.height / 2, 0]} size={[0.6, G.height, 0.6]} color={INK.jiaomo} />
          <Box
            at={[(s * (wallFrom + wallTo)) / 2, 1.3, 0]}
            size={[wallTo - wallFrom, 2.6, 0.4]}
            color="#ddd7ca"
          />
          {/* 灯笼：朱砂只用在这里 */}
          <Box at={[s * pillarX, 3.1, 0.5]} size={[0.36, 0.5, 0.36]} color={INK.zhusha} />
        </group>
      ))}
      <Box at={[0, G.height + 0.25, 0]} size={[pillarX * 2 + 1.4, 0.5, 0.7]} color={INK.jiaomo} />
      <Box at={[0, G.height + 0.65, 0]} size={[pillarX * 2 + 3, 0.3, 2.2]} color={INK.jiaomo} />
    </group>
  );
}

function Terrace() {
  const backZ = LAYOUT.hall.backZ - 3;
  const halfWidth = 16;
  const parapetFrom = S.halfWidth;
  return (
    <group>
      {/* 台地：庭院和大殿都站在上面 */}
      <Box
        at={[0, TERRACE_Y - 7, (C.maxZ + backZ) / 2]}
        size={[halfWidth * 2, 14, C.maxZ - backZ]}
        color={INK.wuhui}
      />
      {[-1, 1].map((s) => (
        <group key={s}>
          {/* 石阶两侧的挡土墙，顶上高出一截当栏杆 */}
          <Box
            at={[(s * (parapetFrom + halfWidth)) / 2, (TERRACE_Y + 1.1) / 2, C.maxZ + 0.25]}
            size={[halfWidth - parapetFrom, TERRACE_Y + 1.1, 0.5]}
            color="#bdb7a9"
          />
          <Box
            at={[s * (C.halfWidth + 0.25), TERRACE_Y + 0.55, (C.minZ + C.maxZ) / 2]}
            size={[0.5, 1.1, C.maxZ - C.minZ]}
            color="#bdb7a9"
          />
        </group>
      ))}
    </group>
  );
}

/** 整座山寺的白模：山门 → 石阶 → 庭院 → 大殿（§3）。点任何一处，就朝那里走。 */
export function Temple() {
  const solid = useRef<Group>(null);
  const dismissHint = useAppStore((s) => s.dismissHint);

  useEffect(() => {
    sceneRefs.solid = solid.current;
    return () => {
      sceneRefs.solid = null;
    };
  }, []);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_SLOP_PX) return;
    if (performance.now() - cameraState.lastMultiTouchAt < 400) return;
    walkTo(e.point.x, e.point.z);
    dismissHint();
  };

  return (
    <group onClick={onClick}>
      <group ref={solid}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[320, 48]} />
          <meshStandardMaterial color="#e2dccf" />
        </mesh>
        <Gate />
        <Instances items={STEPS}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#bdb7a9" flatShading />
        </Instances>
        <Terrace />
        <Hall />
        <Censer />
        <DonationBox />
      </group>
      <Cushions />
    </group>
  );
}
