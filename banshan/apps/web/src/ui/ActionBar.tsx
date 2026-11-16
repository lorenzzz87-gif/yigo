import { ACTIONS, zhCN } from '@banshan/shared';
import { useAppStore } from '../store';
import { doAction, sitAt } from '../store/player';

/**
 * 底部动作栏（§2.1-3、§3）：只有合十、礼拜、木鱼、念珠四个按钮。
 * 无底框，墨线分隔，正在做的那一项下面加一道墨线。礼拜只在坐着时可用。
 * 走到蒲团 2 米内，上方浮出「坐下」。
 */
export function ActionBar() {
  const posture = useAppStore((s) => s.posture);
  const action = useAppStore((s) => s.action);
  const nearSeat = useAppStore((s) => s.nearSeat);
  const dismissHint = useAppStore((s) => s.dismissHint);

  return (
    <div className="bottom">
      {nearSeat !== null && (
        <button
          type="button"
          className="object-button"
          onClick={() => {
            sitAt(nearSeat);
            dismissHint();
          }}
        >
          {zhCN.interact.sit}
        </button>
      )}
      <nav className="action-bar" aria-label={zhCN.actionBarLabel}>
        {ACTIONS.map((a) => (
          <button
            key={a}
            type="button"
            className="action"
            aria-pressed={action === a}
            disabled={a === 'bai' && posture !== 'sit'}
            onClick={() => doAction(a)}
          >
            {zhCN.actions[a]}
          </button>
        ))}
      </nav>
      <p className="footer">{zhCN.footer}</p>
    </div>
  );
}
