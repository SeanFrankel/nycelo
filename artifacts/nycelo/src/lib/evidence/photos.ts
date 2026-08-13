import exifr from "exifr";
import type { HoodRef } from "./types";
import { matchNeighborhood } from "./geo";
import { EvidenceAggregator } from "./aggregator";

/**
 * Reads GPS EXIF from a photo file entirely in the browser.
 * The photo itself is never uploaded — only the matched neighborhood counts.
 * Returns the matched neighborhood name, or null when there's no usable GPS.
 */
export async function parsePhoto(
  file: File,
  hoods: HoodRef[],
  agg: EvidenceAggregator,
): Promise<string | null> {
  const data = await exifr.parse(file, {
    gps: true,
    pick: ["latitude", "longitude", "DateTimeOriginal", "CreateDate"],
  });
  const lat = data?.latitude;
  const lng = data?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const hood = matchNeighborhood(lat, lng, hoods);
  if (!hood) return null;
  agg.addPhoto(hood);
  const when = data?.DateTimeOriginal ?? data?.CreateDate;
  agg.addVisit(hood, when instanceof Date ? when : when ? new Date(when) : null);
  return hood.name;
}
