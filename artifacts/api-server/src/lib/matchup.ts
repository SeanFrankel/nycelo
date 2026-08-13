/**
 * "Fun" matchup selection.
 *
 * Contender A is sampled weighted by popularity (iconic hoods headline
 * more duels). Opponent B is sampled with a weight combining:
 *   - geographic proximity (local rivalries: UWS vs UES, not SI vs Queens)
 *   - popularity (famous vs famous is common)
 *   - rating closeness (interesting, uncertain duels)
 * A small floor weight keeps every pairing possible (wildcards), so
 * low-profile neighborhoods still accumulate games.
 */

export interface MatchupHood {
  id: number;
  lat: number;
  lng: number;
  popularity: number;
}

const EARTH_KM = 6371;

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

/** Sample one item with probability proportional to weightOf(item). */
export function weightedSample<T>(
  items: T[],
  weightOf: (item: T) => number,
  rand: () => number = Math.random,
): T | null {
  let total = 0;
  const weights = items.map((item) => {
    const w = Math.max(0, weightOf(item));
    total += w;
    return w;
  });
  if (total <= 0 || items.length === 0) {
    return items.length ? items[Math.floor(rand() * items.length)] : null;
  }
  let roll = rand() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Decay scale: ~5km apart is a "local rivalry"; 25km barely registers. */
const PROXIMITY_SCALE_KM = 5;
/** Wildcard floor so any pair remains possible. */
const WILDCARD_FLOOR = 0.03;
/** ELO closeness decay: a 300-point gap halves-ish the appeal. */
const RATING_SCALE = 300;

export function opponentWeight(
  a: MatchupHood,
  b: MatchupHood,
  ratingA: number,
  ratingB: number,
): number {
  const dist = haversineKm(a.lat, a.lng, b.lat, b.lng);
  const proximity = Math.exp(-dist / PROXIMITY_SCALE_KM);
  const popularity = b.popularity / 8; // normalize to 0..1
  const closeness = Math.exp(-Math.abs(ratingA - ratingB) / RATING_SCALE);
  // Proximity dominates, popularity and closeness sweeten; floor keeps
  // cross-city oddballs alive.
  return (
    WILDCARD_FLOOR +
    proximity * (0.5 + 0.5 * popularity) * (0.6 + 0.4 * closeness)
  );
}

export function contenderWeight(hood: MatchupHood): number {
  return hood.popularity;
}
