import type { EvidenceResult, HoodRef, ParseOutcome } from "./types";
import { EvidenceAggregator } from "./aggregator";
import { looksLikeTimeline, parseTimeline } from "./timeline";
import { parseGpx, parseKml, extractKmlFromKmz } from "./tracks";
import { parsePhoto } from "./photos";

export type { EvidenceAggregate, EvidenceResult, HoodRef, ParseOutcome } from "./types";

const PHOTO_EXT = /\.(jpe?g|heic|heif|tiff?|png|webp|avif)$/i;

/**
 * Universal evidence importer: accepts any mix of files, auto-detects the
 * format of each, parses everything locally in the browser, and returns
 * per-neighborhood aggregates. Raw files never leave the device.
 */
export async function parseEvidenceFiles(
  files: File[],
  hoods: HoodRef[],
): Promise<EvidenceResult> {
  const agg = new EvidenceAggregator();
  const outcomes: ParseOutcome[] = [];

  for (const file of files) {
    const name = file.name;
    try {
      if (PHOTO_EXT.test(name) || file.type.startsWith("image/")) {
        const matched = await parsePhoto(file, hoods, agg);
        outcomes.push({
          fileName: name,
          kind: "photo",
          ok: matched != null,
          message: matched
            ? `Geotagged in ${matched}`
            : "No GPS data in this photo (or it's outside NYC)",
        });
        continue;
      }

      if (/\.kmz$/i.test(name)) {
        const kmlText = extractKmlFromKmz(await file.arrayBuffer());
        if (!kmlText) {
          outcomes.push({ fileName: name, kind: "kml", ok: false, message: "Couldn't unzip this KMZ" });
          continue;
        }
        const doc = new DOMParser().parseFromString(kmlText, "text/xml");
        const count = parseKml(doc, hoods, agg);
        outcomes.push({
          fileName: name,
          kind: "kml",
          ok: count > 0,
          message: count > 0 ? `${count.toLocaleString()} track points read` : "No coordinates found",
        });
        continue;
      }

      if (/\.(gpx|kml)$/i.test(name)) {
        const doc = new DOMParser().parseFromString(await file.text(), "text/xml");
        const isGpx = /\.gpx$/i.test(name);
        const count = isGpx ? parseGpx(doc, hoods, agg) : parseKml(doc, hoods, agg);
        outcomes.push({
          fileName: name,
          kind: isGpx ? "gpx" : "kml",
          ok: count > 0,
          message: count > 0 ? `${count.toLocaleString()} track points read` : "No coordinates found",
        });
        continue;
      }

      if (/\.json$/i.test(name)) {
        const json = JSON.parse(await file.text());
        if (looksLikeTimeline(json)) {
          const before = agg.size;
          parseTimeline(json, hoods, agg);
          outcomes.push({
            fileName: name,
            kind: "timeline",
            ok: true,
            message:
              agg.size > before || agg.size > 0
                ? "Google Timeline data read"
                : "Timeline read, but no NYC places found",
          });
        } else {
          outcomes.push({
            fileName: name,
            kind: "unknown",
            ok: false,
            message: "This JSON doesn't look like a location history export",
          });
        }
        continue;
      }

      if (/\.zip$/i.test(name)) {
        // Takeout archives: look inside for timeline JSON / KML files.
        const kmlText = extractKmlFromKmz(await file.arrayBuffer());
        let handled = false;
        if (kmlText) {
          const doc = new DOMParser().parseFromString(kmlText, "text/xml");
          handled = parseKml(doc, hoods, agg) > 0;
        }
        try {
          const { unzipSync, strFromU8 } = await import("fflate");
          const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
          for (const [entryName, data] of Object.entries(entries)) {
            if (/\.json$/i.test(entryName)) {
              try {
                const json = JSON.parse(strFromU8(data));
                if (looksLikeTimeline(json)) {
                  parseTimeline(json, hoods, agg);
                  handled = true;
                }
              } catch {
                // skip malformed entries
              }
            }
          }
        } catch {
          // not a readable zip
        }
        outcomes.push({
          fileName: name,
          kind: handled ? "timeline" : "unknown",
          ok: handled,
          message: handled ? "Archive scanned for location data" : "No location data found in this archive",
        });
        continue;
      }

      outcomes.push({
        fileName: name,
        kind: "unknown",
        ok: false,
        message: "We couldn't read this one — try a Timeline JSON, GPX, KML/KMZ, or geotagged photos",
      });
    } catch (err) {
      outcomes.push({
        fileName: name,
        kind: "unknown",
        ok: false,
        message: err instanceof Error ? `Couldn't parse: ${err.message}` : "Couldn't parse this file",
      });
    }
  }

  return { aggregates: agg.toAggregates(), outcomes };
}
