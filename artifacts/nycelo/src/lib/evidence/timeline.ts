import type { HoodRef } from "./types";
import { matchNeighborhood } from "./geo";
import { EvidenceAggregator } from "./aggregator";

/**
 * Parsers for Google Timeline exports.
 * Two formats exist in the wild:
 * 1. Current on-device export from the Google Maps app ("Timeline.json"):
 *    { semanticSegments: [ { startTime, endTime, visit?, activity?, timelinePath? } ] }
 *    Coordinates appear as "40.7128°, -74.0060°" strings in latLng fields.
 * 2. Legacy Google Takeout "Semantic Location History":
 *    { timelineObjects: [ { placeVisit }, { activitySegment } ] }
 *    Coordinates appear as latitudeE7/longitudeE7 integers.
 */

export function looksLikeTimeline(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const obj = json as Record<string, unknown>;
  return (
    Array.isArray(obj.semanticSegments) || Array.isArray(obj.timelineObjects)
  );
}

function parseLatLngString(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== "string") return null;
  const match = value.match(/(-?\d+\.?\d*)\s*°?\s*,\s*(-?\d+\.?\d*)/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

function hoursBetween(start: unknown, end: unknown): number {
  const s = new Date(String(start)).getTime();
  const e = new Date(String(end)).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return 0;
  return (e - s) / 36e5;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

function parseSemanticSegments(segments: AnyObj[], hoods: HoodRef[], agg: EvidenceAggregator): void {
  for (const seg of segments) {
    const when = seg.startTime ? new Date(seg.startTime) : null;

    if (seg.visit) {
      const loc =
        parseLatLngString(seg.visit?.topCandidate?.placeLocation?.latLng) ??
        parseLatLngString(seg.visit?.topCandidate?.placeLocation);
      if (loc) {
        const hood = matchNeighborhood(loc.lat, loc.lng, hoods);
        if (hood) {
          agg.addVisit(hood, when);
          agg.addHours(hood, hoursBetween(seg.startTime, seg.endTime));
        }
      }
    }

    if (seg.activity) {
      const loc =
        parseLatLngString(seg.activity?.start?.latLng) ??
        parseLatLngString(seg.activity?.start);
      if (loc) {
        const hood = matchNeighborhood(loc.lat, loc.lng, hoods);
        if (hood) agg.addActivity(hood);
      }
    }

    if (Array.isArray(seg.timelinePath)) {
      for (const point of seg.timelinePath) {
        const loc = parseLatLngString(point?.point);
        if (loc) {
          const hood = matchNeighborhood(loc.lat, loc.lng, hoods);
          if (hood) agg.addVisit(hood, point.time ? new Date(point.time) : when);
        }
      }
    }
  }
}

function e7ToDeg(value: unknown): number | null {
  const num = Number(value);
  if (!isFinite(num)) return null;
  return num / 1e7;
}

function parseTimelineObjects(objects: AnyObj[], hoods: HoodRef[], agg: EvidenceAggregator): void {
  for (const obj of objects) {
    const pv = obj.placeVisit;
    if (pv) {
      const lat = e7ToDeg(pv.location?.latitudeE7 ?? pv.centerLatE7);
      const lng = e7ToDeg(pv.location?.longitudeE7 ?? pv.centerLngE7);
      if (lat != null && lng != null) {
        const hood = matchNeighborhood(lat, lng, hoods);
        if (hood) {
          const start = pv.duration?.startTimestamp;
          agg.addVisit(hood, start ? new Date(start) : null);
          agg.addHours(
            hood,
            hoursBetween(pv.duration?.startTimestamp, pv.duration?.endTimestamp),
          );
        }
      }
    }
    const act = obj.activitySegment;
    if (act) {
      const lat = e7ToDeg(act.startLocation?.latitudeE7);
      const lng = e7ToDeg(act.startLocation?.longitudeE7);
      if (lat != null && lng != null) {
        const hood = matchNeighborhood(lat, lng, hoods);
        if (hood) agg.addActivity(hood);
      }
    }
  }
}

export function parseTimeline(
  json: AnyObj,
  hoods: HoodRef[],
  agg: EvidenceAggregator,
): void {
  if (Array.isArray(json.semanticSegments)) {
    parseSemanticSegments(json.semanticSegments, hoods, agg);
  }
  if (Array.isArray(json.timelineObjects)) {
    parseTimelineObjects(json.timelineObjects, hoods, agg);
  }
}
