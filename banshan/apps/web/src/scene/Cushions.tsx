import { SEAT_COUNT, TERRACE_Y, seatPosition } from '@banshan/shared';
import { Instances, type Instance } from './primitives';

const ITEMS: Instance[] = Array.from({ length: SEAT_COUNT }, (_, seat) => {
  const p = seatPosition(seat);
  return { position: [p.x, TERRACE_Y + 0.07, p.z] };
});

/** 100 个蒲团，10 × 10。 */
export function Cushions() {
  return (
    <Instances items={ITEMS}>
      <cylinderGeometry args={[0.42, 0.45, 0.14, 10]} />
      <meshStandardMaterial color="#77705f" flatShading />
    </Instances>
  );
}
