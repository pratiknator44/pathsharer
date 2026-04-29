/**
 * Haversine formula — returns distance in meters between two [lng, lat] points.
 */
export function haversineMeters(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number]
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Returns true if candidate origin is within radiusMeters of reference point.
 */
export function isWithinRadius(
  reference: [number, number],
  candidate: [number, number],
  radiusMeters: number
): boolean {
  return haversineMeters(reference, candidate) <= radiusMeters;
}

/**
 * Bearing in degrees from point A to point B.
 */
export function bearingDegrees(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number]
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLng = toRad(lng2 - lng1);
  const lat1R = toRad(lat1);
  const lat2R = toRad(lat2);

  const y = Math.sin(dLng) * Math.cos(lat2R);
  const x =
    Math.cos(lat1R) * Math.sin(lat2R) -
    Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Returns true if two bearings are within toleranceDeg of each other.
 */
export function bearingsAlign(
  a: number,
  b: number,
  toleranceDeg = 45
): boolean {
  const diff = Math.abs(((a - b + 180) % 360) - 180);
  return diff <= toleranceDeg;
}
