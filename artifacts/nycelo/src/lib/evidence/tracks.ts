import { unzipSync, strFromU8 } from "fflate";
import type { HoodRef } from "./types";
import { matchNeighborhood } from "./geo";
import { EvidenceAggregator } from "./aggregator";

/**
 * GPX / KML / KMZ track parsers — the lingua franca of location trackers
 * (Apple fitness exports, Strava, Garmin, Arc, Dawarich, ...).
 * Track points are downsampled, matched to neighborhoods, and counted as
 * day-deduped visits; consecutive timestamped points also accrue hours.
 */

const MAX_POINTS = 200_000;

interface TrackPoint {
  lat: number;
  lng: number;
  time: Date | null;
}

function ingestPoints(points: TrackPoint[], hoods: HoodRef[], agg: EvidenceAggregator): void {
  // Downsample very dense tracks.
  const step = Math.max(1, Math.floor(points.length / 20_000));
  let prev: { hoodId: number; time: Date } | null = null;
  for (let i = 0; i < points.length; i += step) {
    const point = points[i];
    const hood = matchNeighborhood(point.lat, point.lng, hoods);
    if (!hood) {
      prev = null;
      continue;
    }
    agg.addVisit(hood, point.time);
    if (point.time && prev && prev.hoodId === hood.id) {
      const dh = (point.time.getTime() - prev.time.getTime()) / 36e5;
      if (dh > 0 && dh < 6) agg.addHours(hood, dh);
    }
    prev = point.time ? { hoodId: hood.id, time: point.time } : null;
  }
}

export function parseGpx(xml: Document, hoods: HoodRef[], agg: EvidenceAggregator): number {
  const nodes = xml.querySelectorAll("trkpt, wpt");
  const points: TrackPoint[] = [];
  for (const node of nodes) {
    if (points.length >= MAX_POINTS) break;
    const lat = parseFloat(node.getAttribute("lat") ?? "");
    const lng = parseFloat(node.getAttribute("lon") ?? "");
    if (isNaN(lat) || isNaN(lng)) continue;
    const timeText = node.querySelector("time")?.textContent;
    const time = timeText ? new Date(timeText) : null;
    points.push({ lat, lng, time: time && !isNaN(time.getTime()) ? time : null });
  }
  ingestPoints(points, hoods, agg);
  return points.length;
}

export function parseKml(xml: Document, hoods: HoodRef[], agg: EvidenceAggregator): number {
  let count = 0;
  const coordNodes = xml.getElementsByTagName("coordinates");
  const points: TrackPoint[] = [];
  for (const node of coordNodes) {
    const text = node.textContent ?? "";
    for (const tuple of text.trim().split(/\s+/)) {
      if (points.length >= MAX_POINTS) break;
      const [lngStr, latStr] = tuple.split(",");
      const lng = parseFloat(lngStr);
      const lat = parseFloat(latStr);
      if (isNaN(lat) || isNaN(lng)) continue;
      points.push({ lat, lng, time: null });
      count++;
    }
  }
  // KML "when" timestamps (gx:Track) pair with gx:coord nodes.
  const whens = xml.getElementsByTagName("when");
  const gxCoords = xml.getElementsByTagName("gx:coord");
  const timed: TrackPoint[] = [];
  for (let i = 0; i < gxCoords.length && i < MAX_POINTS; i++) {
    const [lngStr, latStr] = (gxCoords[i].textContent ?? "").trim().split(/\s+/);
    const lng = parseFloat(lngStr);
    const lat = parseFloat(latStr);
    if (isNaN(lat) || isNaN(lng)) continue;
    const whenText = i < whens.length ? whens[i].textContent : null;
    const time = whenText ? new Date(whenText) : null;
    timed.push({ lat, lng, time: time && !isNaN(time.getTime()) ? time : null });
    count++;
  }
  ingestPoints(points, hoods, agg);
  ingestPoints(timed, hoods, agg);
  return count;
}

export function extractKmlFromKmz(buffer: ArrayBuffer): string | null {
  try {
    const files = unzipSync(new Uint8Array(buffer));
    for (const [name, data] of Object.entries(files)) {
      if (name.toLowerCase().endsWith(".kml")) return strFromU8(data);
    }
  } catch {
    return null;
  }
  return null;
}
