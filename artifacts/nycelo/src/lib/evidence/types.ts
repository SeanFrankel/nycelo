export interface HoodRef {
  id: number;
  name: string;
  borough: string;
  lat: number;
  lng: number;
}

/** Per-neighborhood aggregates derived locally. Raw data never leaves the browser. */
export interface EvidenceAggregate {
  neighborhoodId: number;
  neighborhoodName: string;
  borough: string;
  visits: number;
  hours: number;
  photos: number;
  activities: number;
}

export interface ParseOutcome {
  fileName: string;
  kind: "timeline" | "gpx" | "kml" | "photo" | "unknown";
  ok: boolean;
  message?: string;
}

export interface EvidenceResult {
  aggregates: EvidenceAggregate[];
  outcomes: ParseOutcome[];
}
