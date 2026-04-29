/**
 * Splits totalMinor cost evenly across n participants.
 * Returns an array of amounts in minor units that sums exactly to totalMinor
 * (remainder distributed to first participants).
 */
export function splitCostEvenly(
  totalMinor: number,
  participantCount: number
): number[] {
  if (participantCount <= 0) return [];
  const base = Math.floor(totalMinor / participantCount);
  const remainder = totalMinor % participantCount;
  return Array.from({ length: participantCount }, (_, i) =>
    i < remainder ? base + 1 : base
  );
}

/**
 * Convert minor units (paise/cents) to major units for display.
 */
export function minorToMajor(minor: number, divisor = 100): number {
  return minor / divisor;
}

/**
 * Convert major units to minor units for storage.
 */
export function majorToMinor(major: number, multiplier = 100): number {
  return Math.round(major * multiplier);
}
