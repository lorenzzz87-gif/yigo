import { Canvas } from '@react-three/fiber';
import { useAppStore } from './store';
import { Overlay } from './ui/Overlay';

/** M0 占位场景：一块地、一个白模方块，只为证明渲染链路通了。M1 起换成山寺。 */
function PlaceholderScene() {
  return (
    <>
      <color attach="background" args={['#EDE8DD']} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 8, 3]} intensity={1.5} />
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[2, 1.5, 1.5]} />
        <meshStandardMaterial color="#8A8578" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#C9C3B5" />
      </mesh>
    </>
  );
}

export function App() {
  const setSceneReady = useAppStore((s) => s.setSceneReady);
  return (
    <div className="stage">
      <Canvas
        camera={{ position: [5, 4, 7], fov: 45 }}
        dpr={[1, 2]}
        onCreated={() => setSceneReady(true)}
      >
        <PlaceholderScene />
      </Canvas>
      <Overlay />
    </div>
  );
}
