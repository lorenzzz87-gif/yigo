import { create } from 'zustand';

interface AppState {
  sceneReady: boolean;
  /** 首次进殿提示，第一次走动后收起 */
  hintVisible: boolean;
  setSceneReady: (ready: boolean) => void;
  dismissHint: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  sceneReady: false,
  hintVisible: true,
  setSceneReady: (sceneReady) => set({ sceneReady }),
  dismissHint: () => set({ hintVisible: false }),
}));
