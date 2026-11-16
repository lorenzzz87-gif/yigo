import { Instances, type Instance } from './primitives';
import { INK } from './palette';

/** 三层远山，越远越淡。位置写死，保证每个人看到的山是同一座。 */
function ring(count: number, radius: number, height: number, phase: number): Instance[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + phase;
    const wobble = 0.75 + 0.5 * Math.abs(Math.sin(i * 12.9898 + phase * 7));
    const h = height * wobble;
    return {
      position: [Math.sin(a) * radius, h / 2 - 2, Math.cos(a) * radius],
      scale: [radius * 0.38 * wobble, h, radius * 0.38 * wobble],
      rotationY: i * 1.3,
    };
  });
}

const LAYERS = [
  { items: ring(7, 95, 38, 0.4), color: '#9a9588' },
  { items: ring(9, 150, 62, 1.1), color: '#b3ad9f' },
  { items: ring(11, 215, 90, 0.2), color: INK.wuhui },
];

/** 天、雾、光和远山。M5 起光照跟随当地时间。 */
export function Sky() {
  return (
    <>
      <color attach="background" args={[INK.xuan]} />
      <fog attach="fog" args={[INK.xuan, 45, 260]} />
      <hemisphereLight args={[INK.xuan, INK.danmo, 1.5]} />
      <directionalLight position={[6, 14, 10]} intensity={1.6} />
      {LAYERS.map((layer) => (
        <Instances key={layer.color} items={layer.items}>
          <coneGeometry args={[1, 1, 5, 1]} />
          <meshBasicMaterial color={layer.color} />
        </Instances>
      ))}
    </>
  );
}
