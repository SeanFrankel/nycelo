import type { Experience } from "@workspace/db";

export type ExperienceTier = "experienced" | "probable" | "minimal" | "none";

export interface ExperienceAggregates {
  visits: number;
  hours: number;
  photos: number;
  activities: number;
  checkins: number;
}

// Sanity caps: reject/clamp obviously impossible aggregates.
export const CAPS = {
  visits: 5000,
  hours: 50000,
  photos: 5000,
  activities: 2000,
  checkins: 1000,
} as const;

export function clampAggregates(a: Partial<ExperienceAggregates>): ExperienceAggregates {
  const clamp = (v: unknown, cap: number) =>
    Math.min(Math.max(Math.floor(Number(v) || 0), 0), cap);
  return {
    visits: clamp(a.visits, CAPS.visits),
    hours: Math.min(Math.max(Number(a.hours) || 0, 0), CAPS.hours),
    photos: clamp(a.photos, CAPS.photos),
    activities: clamp(a.activities, CAPS.activities),
    checkins: clamp(a.checkins, CAPS.checkins),
  };
}

/**
 * Experience confidence, 0-100, with diminishing returns per signal.
 * Visits weigh most; hours and activities boost; photos corroborate;
 * a lone check-in gives a small bump.
 */
export function confidenceFor(a: ExperienceAggregates): number {
  const signal =
    0.45 * a.visits +
    0.012 * a.hours +
    0.2 * a.photos +
    0.25 * a.activities +
    0.35 * a.checkins;
  const conf = 1 - Math.exp(-signal / 2.2);
  return Math.round(conf * 100);
}

export function tierFor(confidence: number): ExperienceTier {
  if (confidence >= 75) return "experienced";
  if (confidence >= 40) return "probable";
  if (confidence > 0) return "minimal";
  return "none";
}

/**
 * K-factor multiplier for a vote given the voter's confidence (0-100)
 * in each of the two matchup neighborhoods.
 * Floor 0.25 (zero-evidence votes still count), up to 2.0 when the voter
 * has proven experience in both neighborhoods.
 */
export function voteWeight(confA: number, confB: number): number {
  const avg = (confA + confB) / 200; // 0..1
  const weight = 0.25 + 1.75 * avg;
  return Math.round(weight * 1000) / 1000;
}

export function toEntryShape(
  row: Experience,
  neighborhood: { id: number; name: string; borough: string },
) {
  const aggregates = {
    visits: row.visits,
    hours: row.hours,
    photos: row.photos,
    activities: row.activities,
    checkins: row.checkins,
  };
  const confidence = confidenceFor(aggregates);
  return {
    neighborhoodId: neighborhood.id,
    neighborhoodName: neighborhood.name,
    borough: neighborhood.borough,
    ...aggregates,
    hours: Math.round(row.hours * 10) / 10,
    confidence,
    tier: tierFor(confidence),
  };
}
