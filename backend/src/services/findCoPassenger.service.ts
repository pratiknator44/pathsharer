import { redisClient } from "../database/redis";

// ---------------------------------------------------------------------------
// Coverage radius
// 1 degree of latitude ≈ 111.12 km  →  5 km ≈ 0.04496°
// We work in degree-space so the circle equation stays unit-consistent.
// ---------------------------------------------------------------------------
const COVERAGE_RADIUS_KM = 5;
const COVERAGE_RADIUS_DEG = COVERAGE_RADIUS_KM / 111.12; // ≈ 0.04496°
const R_SQUARED = COVERAGE_RADIUS_DEG * COVERAGE_RADIUS_DEG;

// Shape stored in Redis by activeUser.controller
interface CachedActiveUser {
  userId: string;
  isActive: boolean;
  source: { name: string; coordinates: [number, number] }; // [lng, lat]
  destination: { name: string; coordinates: [number, number] };
  updatedAt: string;
}

/**
 * Point-in-circle test using the formula:
 *   (x1 - x)² + (y1 - y)² - r² ≤ 0
 *
 * Returns true when the candidate point (cx, cy) lies inside or on the
 * boundary of the circle centred at the reference point (px, py).
 */
function isWithinRadius(
  px: number, py: number, // reference  [lng, lat]
  cx: number, cy: number  // candidate  [lng, lat]
): boolean {
  const dx = cx - px;
  const dy = cy - py;
  return dx * dx + dy * dy - R_SQUARED <= 0;
}

/**
 * Scans every `active-user:*` key in Redis and returns the subset whose
 * **source** or **destination** falls within COVERAGE_RADIUS_KM of the
 * given [lng, lat].
 *
 * @param lng  Searcher's longitude
 * @param lat  Searcher's latitude
 * @returns    Array of nearby active users (may be empty)
 */
export async function findUsersByCoords(
  lng: number,
  lat: number
): Promise<CachedActiveUser[]> {
  if (!redisClient.isOpen) {
    console.warn("[findCoPassenger] Redis is not connected — returning empty result.");
    return [];
  }

  // ------------------------------------------------------------------
  // 1. Collect all active-user keys via scanIterator (cursor-managed
  //    internally by the redis client — avoids blocking KEYS * command).
  // ------------------------------------------------------------------
  const keys: string[] = [];

  for await (const keyOrChunk of redisClient.scanIterator({
    MATCH: "active-user:*",
    COUNT: 100,
  })) {
    if (Array.isArray(keyOrChunk)) {
      keys.push(...keyOrChunk);
    } else {
      keys.push(keyOrChunk as string);
    }
  }

  if (keys.length === 0) return [];

  // ------------------------------------------------------------------
  // 2. Fetch all values in a single MGET round-trip.
  // ------------------------------------------------------------------
  const values = await redisClient.mGet(keys);

  // ------------------------------------------------------------------
  // 3. Filter by the circle equation for source AND destination.
  // ------------------------------------------------------------------
  const nearby: CachedActiveUser[] = [];

  for (const raw of values) {
    if (!raw) continue;

    try {
      const user = JSON.parse(raw) as CachedActiveUser;

      if (!user.isActive) continue;

      const [srcLng, srcLat] = user.source.coordinates;
      const [dstLng, dstLat] = user.destination.coordinates;

      const sourceNear = isWithinRadius(lng, lat, srcLng, srcLat);
      const destNear   = isWithinRadius(lng, lat, dstLng, dstLat);

      if (sourceNear || destNear) {
        nearby.push(user);
      }
    } catch {
      // Skip malformed / stale entries silently
    }
  }

  return nearby;
}
