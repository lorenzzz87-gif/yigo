import { zhCN } from '@banshan/shared';
import { useAppStore } from '../store';
import { adoptServerState, onSeatOk, onSeatTaken, player, reannounce } from '../store/player';
import { net } from './client';
import { getAnonId, randomName, saveName } from './identity';
import { applyDelta, applySnapshot } from './remotes';

let selfId = '';
let everJoined = false;

/** 把网络消息接到场景上。应用启动时调用一次。 */
export function startSession(): void {
  net.start({
    hello: () => ({ anonId: getAnonId(), name: player.name }),
    message(msg) {
      const now = performance.now();
      switch (msg.type) {
        case 'snapshot': {
          selfId = msg.selfId;
          const me = msg.players.find((p) => p.id === selfId);
          if (me) {
            // 第一次进殿，或 30 秒内回来：以服务器记着的位置为准（回到原位）
            if (!everJoined || msg.resumed) adoptServerState(me);
            else reannounce();
            player.name = me.name;
          }
          everJoined = true;
          applySnapshot(msg.players, selfId, now);
          return;
        }
        case 'delta':
          applyDelta(msg, selfId, now);
          return;
        case 'seat_ok':
          onSeatOk(msg.seat);
          return;
        case 'seat_taken':
          onSeatTaken(msg.seat);
          useAppStore.getState().showNotice(zhCN.seatTaken);
          return;
        case 'lamps':
        case 'incense_count':
          // M4、M6 接入
          return;
      }
    },
  });
}

/** 换个名字：每次访问只能换一次（§2.1-1），新名字仍从名字池里抽。 */
export function rename(): void {
  const store = useAppStore.getState();
  if (store.renamed) return;
  const name = randomName(player.name);
  player.name = name;
  saveName(name);
  net.send({ type: 'rename', name });
  store.setName(name, true);
}
