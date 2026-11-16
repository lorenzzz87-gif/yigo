/** 镜头的限位（§2.1-2）：俯仰夹在地平线以上、头顶以下，所以不会翻转。 */
export const CAMERA_LIMITS = {
  minPitch: 0.12,
  maxPitch: 1.25,
  minDistance: 3,
  maxDistance: 14,
} as const;

/** 镜头的轨道参数。由手势直接改写，CameraRig 每帧读取。 */
export const cameraState = {
  /** 绕角色的水平角，弧度；0 表示镜头在角色的 +z 一侧 */
  yaw: 0,
  /** 仰角，弧度 */
  pitch: 0.42,
  /** 想要的距离；被墙挡住时实际距离会更近 */
  distance: 7.5,
  /** 最近一次双指手势的时间戳，用来忽略随后的误点 */
  lastMultiTouchAt: 0,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function orbit(dYaw: number, dPitch: number): void {
  cameraState.yaw += dYaw;
  cameraState.pitch = clamp(
    cameraState.pitch + dPitch,
    CAMERA_LIMITS.minPitch,
    CAMERA_LIMITS.maxPitch,
  );
}

export function zoom(factor: number): void {
  if (!Number.isFinite(factor) || factor <= 0) return;
  cameraState.distance = clamp(
    cameraState.distance * factor,
    CAMERA_LIMITS.minDistance,
    CAMERA_LIMITS.maxDistance,
  );
}
