import { zhCN } from '@banshan/shared';
import { useAppStore } from '../store';

export function Overlay() {
  const sceneReady = useAppStore((s) => s.sceneReady);
  const hintVisible = useAppStore((s) => s.hintVisible);
  return (
    <div className="overlay">
      <p className={`hint ${sceneReady && hintVisible ? '' : 'hint-hidden'}`}>
        {sceneReady ? zhCN.firstHint : zhCN.loading}
      </p>
      <p className="footer">{zhCN.footer}</p>
    </div>
  );
}
