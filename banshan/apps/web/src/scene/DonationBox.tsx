import { LAYOUT, TERRACE_Y } from '@banshan/shared';
import { Box } from './primitives';
import { INK } from './palette';

/** 功德箱。随喜面板在 M4、M6 接入。 */
export function DonationBox() {
  const { x, z } = LAYOUT.donationBox;
  return (
    <group position={[x, TERRACE_Y, z]}>
      <Box at={[0, 0.4, 0]} size={[1, 0.8, 0.6]} color="#5f5a4f" />
      <Box at={[0, 0.81, 0]} size={[0.5, 0.02, 0.08]} color={INK.jiaomo} />
    </group>
  );
}
