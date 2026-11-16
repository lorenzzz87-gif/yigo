import { create } from 'zustand';

/** 全局状态。M0 只有场景是否就绪；后续里程碑在这里扩展。 */
interface AppState {
  sceneReady: boolean;
  setSceneReady: (ready: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sceneReady: false,
  setSceneReady: (sceneReady) => set({ sceneReady }),
}));
