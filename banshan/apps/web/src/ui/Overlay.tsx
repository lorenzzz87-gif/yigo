import { zhCN } from '@banshan/shared';
import { useAppStore } from '../store';

export function Overlay() {
  const sceneReady = useAppStore((s) => s.sceneReady);
  return (
    <div className="overlay">
      <header className="brand">
        <h1>{zhCN.brand.name}</h1>
        <p>{zhCN.brand.subtitle}</p>
      </header>
      {!sceneReady && <p>{zhCN.loading}</p>}
      <p className="footer">{zhCN.footer}</p>
    </div>
  );
}
