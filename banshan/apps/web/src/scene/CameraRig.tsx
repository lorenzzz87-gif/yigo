import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Raycaster, Vector3 } from 'three';
import { player } from '../store/player';
import { cameraState, orbit, zoom } from './cameraState';
import { sceneRefs } from './refs';

const ROTATE_SPEED = 0.005;
/** 镜头看向角色头顶附近 */
const FOCUS_HEIGHT = 0.95;
/** 镜头离障碍物表面至少这么远，防止近裁面切进墙里 */
const WALL_MARGIN = 0.4;
const MIN_ACTUAL_DISTANCE = 0.6;
/** 除了正中一条射线，再向四周偏一点各打一条，覆盖近裁面的四个角 */
const PROBE_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.35, 0],
  [-0.35, 0],
  [0, 0.25],
  [0, -0.25],
];

/**
 * 第三人称跟随镜头（§2.1-2）。
 * 单指或鼠标拖动旋转，双指或滚轮缩放；被墙、屋顶、地面挡住时把镜头拉近，不穿墙。
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const raycaster = useMemo(() => new Raycaster(), []);
  const rig = useRef({
    focus: new Vector3(player.x, player.y + FOCUS_HEIGHT, player.z),
    distance: cameraState.distance,
  });
  const tmp = useMemo(
    () => ({
      dir: new Vector3(),
      right: new Vector3(),
      up: new Vector3(),
      target: new Vector3(),
      probeDir: new Vector3(),
      worldUp: new Vector3(0, 1, 0),
    }),
    [],
  );

  useEffect(() => {
    const pointers = new Map<number, { x: number; y: number }>();
    const span = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size > 1) cameraState.lastMultiTouchAt = performance.now();
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      if (pointers.size === 1) {
        orbit(-(e.clientX - prev.x) * ROTATE_SPEED, (e.clientY - prev.y) * ROTATE_SPEED);
        prev.x = e.clientX;
        prev.y = e.clientY;
      } else {
        const before = span();
        prev.x = e.clientX;
        prev.y = e.clientY;
        const after = span();
        if (before > 0 && after > 0) zoom(before / after);
        cameraState.lastMultiTouchAt = performance.now();
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(Math.exp(e.deltaY * 0.001));
    };

    dom.style.touchAction = 'none';
    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('wheel', onWheel);
    };
  }, [dom]);

  // 不设优先级（正优先级会接管 R3F 的渲染循环）。CameraRig 挂在 Player 之后，所以每帧在角色移动之后更新。
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { focus } = rig.current;
    const { dir, right, up, target, probeDir, worldUp } = tmp;

    target.set(player.x, player.y + FOCUS_HEIGHT, player.z);
    focus.lerp(target, 1 - Math.exp(-12 * dt));

    const { yaw, pitch, distance: wanted } = cameraState;
    dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    right.crossVectors(worldUp, dir).normalize();
    up.crossVectors(dir, right);

    let allowed = wanted;
    const solid = sceneRefs.solid;
    if (solid) {
      for (const [ox, oy] of PROBE_OFFSETS) {
        probeDir
          .copy(dir)
          .multiplyScalar(wanted)
          .addScaledVector(right, ox)
          .addScaledVector(up, oy);
        const len = probeDir.length();
        raycaster.set(focus, probeDir.divideScalar(len));
        raycaster.far = len + WALL_MARGIN;
        const hit = raycaster.intersectObject(solid, true)[0];
        if (hit) allowed = Math.min(allowed, hit.distance - WALL_MARGIN);
      }
    }
    allowed = Math.max(MIN_ACTUAL_DISTANCE, allowed);

    // 被挡住时立刻拉近，障碍消失后慢慢退回去
    const r = rig.current;
    r.distance =
      allowed < r.distance
        ? allowed
        : r.distance + (allowed - r.distance) * (1 - Math.exp(-4 * dt));

    camera.position.copy(focus).addScaledVector(dir, r.distance);
    camera.lookAt(focus);
  });

  return null;
}
