import { useFrame } from '@react-three/fiber';
import { remotes } from '../net/remotes';
import { useAppStore } from '../store';
import { stepActor } from './actor';
import { Avatar } from './Avatar';

/**
 * 殿里的其他人。每个人的走路在本机插值（§4.5）。
 * 现在每人一组网格；M7 换成 GPU instancing 以满足 draw call 预算（§4.8）。
 */
export function Remotes() {
  const ids = useAppStore((s) => s.remoteIds);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const now = performance.now();
    for (const actor of remotes.values()) stepActor(actor, dt, now);
  });

  return (
    <>
      {ids.map((id) => {
        const actor = remotes.get(id);
        return actor ? <Avatar key={id} source={actor} /> : null;
      })}
    </>
  );
}
