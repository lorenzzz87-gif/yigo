import type { Action, Posture } from '@banshan/shared';
import { create } from 'zustand';

interface AppState {
  sceneReady: boolean;
  /** 首次进殿提示，第一次走动后收起 */
  hintVisible: boolean;
  /** 自己的姿态和正在做的动作，驱动动作栏 */
  posture: Posture;
  action: Action | null;
  /** 2 米内最近的蒲团；没有或已坐下时为 null */
  nearSeat: number | null;
  setSceneReady: (ready: boolean) => void;
  dismissHint: () => void;
  setAvatar: (posture: Posture, action: Action | null) => void;
  setNearSeat: (seat: number | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sceneReady: false,
  hintVisible: true,
  posture: 'stand',
  action: null,
  nearSeat: null,
  setSceneReady: (sceneReady) => set({ sceneReady }),
  dismissHint: () => set({ hintVisible: false }),
  setAvatar: (posture, action) => set({ posture, action }),
  setNearSeat: (nearSeat) => set({ nearSeat }),
}));
