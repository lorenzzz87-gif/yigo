import type { Action, Posture } from '@banshan/shared';
import { create } from 'zustand';

interface AppState {
  sceneReady: boolean;
  /** 首次进殿提示，第一次走动后收起 */
  hintVisible: boolean;
  /** 自己的名字，以及这次访问是否已经换过 */
  name: string;
  renamed: boolean;
  /** 自己的姿态和正在做的动作，驱动动作栏 */
  posture: Posture;
  action: Action | null;
  /** 2 米内最近的蒲团；没有或已坐下时为 null */
  nearSeat: number | null;
  /** 殿里其他人的 id，进出时更新 */
  remoteIds: string[];
  /** 一句轻提示，过几秒自己消失 */
  notice: { text: string; id: number } | null;
  setSceneReady: (ready: boolean) => void;
  dismissHint: () => void;
  setName: (name: string, renamed: boolean) => void;
  setAvatar: (posture: Posture, action: Action | null) => void;
  setNearSeat: (seat: number | null) => void;
  setRemoteIds: (ids: string[]) => void;
  showNotice: (text: string) => void;
}

const NOTICE_MS = 3200;
let noticeSeq = 0;

export const useAppStore = create<AppState>((set, get) => ({
  sceneReady: false,
  hintVisible: true,
  name: '',
  renamed: false,
  posture: 'stand',
  action: null,
  nearSeat: null,
  remoteIds: [],
  notice: null,
  setSceneReady: (sceneReady) => set({ sceneReady }),
  dismissHint: () => set({ hintVisible: false }),
  setName: (name, renamed) => set({ name, renamed }),
  setAvatar: (posture, action) => set({ posture, action }),
  setNearSeat: (nearSeat) => set({ nearSeat }),
  setRemoteIds: (remoteIds) => set({ remoteIds }),
  showNotice: (text) => {
    const id = ++noticeSeq;
    set({ notice: { text, id } });
    setTimeout(() => {
      if (get().notice?.id === id) set({ notice: null });
    }, NOTICE_MS);
  },
}));
