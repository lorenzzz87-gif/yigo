import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Object3D, type InstancedMesh } from 'three';

type V3 = readonly [number, number, number];

/** 白模用的方块：给出中心和尺寸。 */
export function Box({ at, size, color }: { at: V3; size: V3; color: string }) {
  return (
    <mesh position={at as [number, number, number]}>
      <boxGeometry args={size as [number, number, number]} />
      <meshStandardMaterial color={color} flatShading />
    </mesh>
  );
}

export interface Instance {
  position: V3;
  scale?: V3;
  rotationY?: number;
}

/** 同一几何体画很多份，只占一次 draw call（§4.8）。children 里放 geometry 和 material。 */
export function Instances({
  items,
  children,
}: {
  items: readonly Instance[];
  children: ReactNode;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    items.forEach((it, i) => {
      dummy.position.set(...(it.position as [number, number, number]));
      dummy.scale.set(...((it.scale ?? [1, 1, 1]) as [number, number, number]));
      dummy.rotation.set(0, it.rotationY ?? 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      {children}
    </instancedMesh>
  );
}
