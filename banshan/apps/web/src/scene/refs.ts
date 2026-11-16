import type { Object3D } from 'three';

/** 场景里会挡住镜头的实体（地面、墙、屋顶）。Temple 挂载时填入，CameraRig 每帧读取。 */
export const sceneRefs: { solid: Object3D | null } = { solid: null };
