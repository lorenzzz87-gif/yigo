import { Canvas } from '@react-three/fiber';
import { Player } from './avatar/Player';
import { Remotes } from './avatar/Remotes';
import { net } from './net/client';
import { remotes } from './net/remotes';
import { CameraRig } from './scene/CameraRig';
import { cameraState } from './scene/cameraState';
import { MoveMarker } from './scene/MoveMarker';
import { Sky } from './scene/Sky';
import { Temple } from './scene/Temple';
import { useAppStore } from './store';
import { doAction, player, sitAt, walkTo } from './store/player';
import { Overlay } from './ui/Overlay';

export function App() {
  const setSceneReady = useAppStore((s) => s.setSceneReady);
  return (
    <div className="stage">
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 600 }}
        dpr={[1, 2]}
        onCreated={(state) => {
          setSceneReady(true);
          if (import.meta.env.DEV) {
            // 仅开发环境：给调试和自动化检查用
            Object.assign(window, {
              __banshan: {
                player,
                cameraState,
                walkTo,
                sitAt,
                doAction,
                net,
                remotes,
                three: state,
              },
            });
          }
        }}
      >
        <Sky />
        <Temple />
        <Player />
        <Remotes />
        <MoveMarker />
        <CameraRig />
      </Canvas>
      <Overlay />
    </div>
  );
}
