import { INTERACT_RADIUS_M, nearestSeat } from '@banshan/shared';
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '../store';
import { player, publishAvatar } from '../store/player';
import { stepActor } from './actor';
import { Avatar } from './Avatar';

/** 自己：每帧推进走路和动作，再交给 Avatar 去画。 */
export function Player() {
  useFrame((_, rawDt) => {
    stepActor(player, Math.min(rawDt, 0.1), performance.now());
    publishAvatar();

    const near = player.seated ? null : nearestSeat(player.x, player.z, INTERACT_RADIUS_M);
    const store = useAppStore.getState();
    if (store.nearSeat !== near) store.setNearSeat(near);
  });

  // 自己的名字不挂在头顶：进殿时已经告诉过你了
  return <Avatar source={player} showName={false} />;
}
