import type { HoodRef } from "./types";

const EARTH_KM = 6371;
/** Max distance from a neighborhood centroid to count as "in" it. */
export const MATCH_CAP_KM = 2;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return EARTH_KM * 2 * Math.asin(Math.sqrt(a));
}

/** NYC bounding box (generous) to quickly discard non-NYC points. */
export function inNycBounds(lat: number, lng: number): boolean {
  return lat > 40.45 && lat < 40.95 && lng > -74.3 && lng < -73.65;
}

/** Nearest neighborhood within the cap, or null. */
export function matchNeighborhood(
  lat: number,
  lng: number,
  hoods: HoodRef[],
): HoodRef | null {
  if (!inNycBounds(lat, lng)) return null;
  let best: HoodRef | null = null;
  let bestDist = MATCH_CAP_KM;
  for (const hood of hoods) {
    const dist = haversineKm(lat, lng, hood.lat, hood.lng);
    if (dist < bestDist) {
      best = hood;
      bestDist = dist;
    }
  }
  return best;
}
