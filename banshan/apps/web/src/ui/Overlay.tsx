import { zhCN } from '@banshan/shared';
import { rename } from '../net/session';
import { useAppStore } from '../store';
import { ActionBar } from './ActionBar';

export function Overlay() {
  const sceneReady = useAppStore((s) => s.sceneReady);
  const hintVisible = useAppStore((s) => s.hintVisible);
  const name = useAppStore((s) => s.name);
  const renamed = useAppStore((s) => s.renamed);
  const notice = useAppStore((s) => s.notice);
  const showIntro = sceneReady && hintVisible;
  return (
    <div className="overlay">
      <div className={`intro ${sceneReady && !hintVisible ? 'intro-hidden' : ''}`}>
        <p className="hint">{sceneReady ? zhCN.firstHint : zhCN.loading}</p>
        {sceneReady && (
          <p className="you">
            {zhCN.youAre.replace('{name}', name)}
            {!renamed && (
              <button type="button" className="rename" disabled={!showIntro} onClick={rename}>
                {zhCN.rename}
              </button>
            )}
          </p>
        )}
      </div>
      <div className="bottom-stack">
        <p className={`notice ${notice ? '' : 'notice-hidden'}`} role="status">
          {notice?.text}
        </p>
        {sceneReady && <ActionBar />}
      </div>
    </div>
  );
}
