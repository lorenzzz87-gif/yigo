import { expect, it } from 'vitest';
import { useAppStore } from './index';

it('starts not ready and flips when the scene is created', () => {
  expect(useAppStore.getState().sceneReady).toBe(false);
  useAppStore.getState().setSceneReady(true);
  expect(useAppStore.getState().sceneReady).toBe(true);
});
