import { SEAT_HEIGHT, type AnimState } from '@banshan/shared';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Quaternion, Vector3, type Group, type Mesh } from 'three';
import { INK } from '../scene/palette';
import { NameTag } from './NameTag';
import { MODEL, blendPose, bodyMetrics, targetPose, type Pose } from './pose';

/** 每帧从这里读一个角色此刻的状态 */
export interface AvatarSource {
  name: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  anim: AnimState;
  seated: boolean;
  /** 进入当前动画状态后经过的秒数 */
  animTime: number;
}

const ROBE = INK.danmo;
const SKIN = '#d8ccb8';
const WOOD = '#5f5a4f';
/** 姿势追上目标的速度；越大越干脆 */
const POSE_RATE = 12;
const DOWN = new Vector3(0, -1, 0);

/**
 * 小沙弥白模：锥身、球头、两条手臂，木鱼和念珠只在用到时出现。
 * 姿势每帧朝目标平滑靠拢，所以七个状态之间怎么切都不会跳。
 */
export function Avatar({ source, showName = true }: { source: AvatarSource; showName?: boolean }) {
  const root = useRef<Group>(null);
  const lean = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const head = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const muyu = useRef<Group>(null);
  const mallet = useRef<Mesh>(null);
  const beads = useRef<Mesh>(null);
  const current = useRef<Pose | null>(null);
  const tmp = useMemo(() => ({ dir: new Vector3(), q: new Quaternion() }), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const target = targetPose(source.anim, source.seated, source.animTime);
    const pose = current.current
      ? blendPose(current.current, target, 1 - Math.exp(-POSE_RATE * dt))
      : target;
    current.current = pose;
    const m = bodyMetrics(pose.sit);

    root.current?.position.set(source.x, source.y + SEAT_HEIGHT * pose.sit + pose.lift, source.z);
    if (root.current) root.current.rotation.y = source.heading;
    if (lean.current) lean.current.rotation.x = pose.pitch;
    if (body.current) {
      body.current.scale.set(m.sxz, m.sy, m.sxz);
      body.current.position.y = m.height / 2;
    }
    head.current?.position.set(0, m.headY, 0);

    for (const [ref, dir, side] of [
      [armR, pose.armR, 1],
      [armL, pose.armL, -1],
    ] as const) {
      const arm = ref.current;
      if (!arm) continue;
      arm.position.set(side * m.shoulderX, m.shoulderY, 0);
      tmp.dir.set(dir[0], dir[1], dir[2]);
      arm.quaternion.copy(tmp.q.setFromUnitVectors(DOWN, tmp.dir));
    }

    // 道具不参与过渡：进入动作就出现，离开就收起
    if (muyu.current) muyu.current.visible = target.prop === 'muyu';
    if (mallet.current) mallet.current.visible = target.prop === 'muyu';
    if (beads.current) {
      beads.current.visible = target.prop === 'nianzhu';
      beads.current.rotation.z = source.animTime * 0.8;
    }
  });

  const arm = (
    <>
      <mesh position={[0, -MODEL.armLength / 2, 0]}>
        <capsuleGeometry args={[MODEL.armRadius, MODEL.armLength - MODEL.armRadius * 2, 2, 6]} />
        <meshStandardMaterial color={ROBE} flatShading />
      </mesh>
      <mesh position={[0, -MODEL.armLength, 0]}>
        <icosahedronGeometry args={[MODEL.handRadius, 1]} />
        <meshStandardMaterial color={SKIN} flatShading />
      </mesh>
    </>
  );

  return (
    <group ref={root}>
      {showName && (
        <NameTag source={source} y={MODEL.bodyHeight + MODEL.headAbove + MODEL.headRadius + 0.22} />
      )}
      <group ref={lean}>
        <mesh ref={body}>
          <cylinderGeometry
            args={[MODEL.bodyTopRadius, MODEL.bodyBottomRadius, MODEL.bodyHeight, 10]}
          />
          <meshStandardMaterial color={ROBE} flatShading />
        </mesh>
        <group ref={head}>
          <mesh>
            <icosahedronGeometry args={[MODEL.headRadius, 2]} />
            <meshStandardMaterial color={SKIN} flatShading />
          </mesh>
          {/* 闭着的眼睛：两道短墨线 */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.085, 0.01, MODEL.headRadius - 0.012]}>
              <boxGeometry args={[0.06, 0.012, 0.02]} />
              <meshBasicMaterial color={INK.jiaomo} />
            </mesh>
          ))}
        </group>
        <group ref={armR}>
          {arm}
          {/* 木槌，握在右手 */}
          <mesh
            ref={mallet}
            visible={false}
            position={[-0.05, -MODEL.armLength - 0.03, 0.03]}
            rotation={[0, 0, 0.9]}
          >
            <cylinderGeometry args={[0.015, 0.015, 0.16, 5]} />
            <meshStandardMaterial color={WOOD} flatShading />
          </mesh>
          {/* 念珠，挂在右手 */}
          <mesh ref={beads} visible={false} position={[-0.05, -MODEL.armLength - 0.11, 0.03]}>
            <torusGeometry args={[0.075, 0.014, 5, 14]} />
            <meshStandardMaterial color={WOOD} flatShading />
          </mesh>
        </group>
        <group ref={armL}>
          {arm}
          {/* 木鱼，托在左手 */}
          <group ref={muyu} visible={false} position={[0.06, -MODEL.armLength - 0.01, 0.1]}>
            <mesh scale={[1, 0.8, 1]}>
              <icosahedronGeometry args={[0.085, 1]} />
              <meshStandardMaterial color={WOOD} flatShading />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
