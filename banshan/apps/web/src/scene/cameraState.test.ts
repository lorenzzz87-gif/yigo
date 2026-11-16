import { beforeEach, describe, expect, it } from 'vitest';
import { CAMERA_LIMITS, cameraState, orbit, zoom } from './cameraState';

beforeEach(() => {
  cameraState.yaw = 0;
  cameraState.pitch = 0.42;
  cameraState.distance = 7.5;
});

describe('camera limits', () => {
  it('never pitches past the limits, so the view cannot flip', () => {
    orbit(0, 100);
    expect(cameraState.pitch).toBe(CAMERA_LIMITS.maxPitch);
    expect(cameraState.pitch).toBeLessThan(Math.PI / 2);
    orbit(0, -100);
    expect(cameraState.pitch).toBe(CAMERA_LIMITS.minPitch);
    expect(cameraState.pitch).toBeGreaterThan(0);
  });

  it('lets yaw turn freely', () => {
    orbit(10, 0);
    expect(cameraState.yaw).toBe(10);
  });

  it('clamps zoom and ignores bad input', () => {
    zoom(100);
    expect(cameraState.distance).toBe(CAMERA_LIMITS.maxDistance);
    zoom(0.001);
    expect(cameraState.distance).toBe(CAMERA_LIMITS.minDistance);
    zoom(NaN);
    zoom(0);
    zoom(-2);
    expect(cameraState.distance).toBe(CAMERA_LIMITS.minDistance);
  });
});
