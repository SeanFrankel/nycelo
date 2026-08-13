import type { EvidenceAggregate, HoodRef } from "./types";

interface Bucket {
  hood: HoodRef;
  visitDays: Set<string>;
  extraVisits: number;
  hours: number;
  photos: number;
  activities: number;
}

/** Accumulates matched signals into per-neighborhood aggregates. */
export class EvidenceAggregator {
  private buckets = new Map<number, Bucket>();

  private bucket(hood: HoodRef): Bucket {
    let b = this.buckets.get(hood.id);
    if (!b) {
      b = {
        hood,
        visitDays: new Set(),
        extraVisits: 0,
        hours: 0,
        photos: 0,
        activities: 0,
      };
      this.buckets.set(hood.id, b);
    }
    return b;
  }

  /** A visit on a given day (deduped per day) or an undated visit. */
  addVisit(hood: HoodRef, when?: Date | null): void {
    const b = this.bucket(hood);
    if (when && !isNaN(when.getTime())) {
      b.visitDays.add(when.toISOString().slice(0, 10));
    } else {
      b.extraVisits += 1;
    }
  }

  addHours(hood: HoodRef, hours: number): void {
    if (hours > 0 && isFinite(hours)) this.bucket(hood).hours += Math.min(hours, 24);
  }

  addPhoto(hood: HoodRef): void {
    this.bucket(hood).photos += 1;
  }

  addActivity(hood: HoodRef): void {
    this.bucket(hood).activities += 1;
  }

  get size(): number {
    return this.buckets.size;
  }

  toAggregates(): EvidenceAggregate[] {
    return [...this.buckets.values()]
      .map((b) => ({
        neighborhoodId: b.hood.id,
        neighborhoodName: b.hood.name,
        borough: b.hood.borough,
        visits: b.visitDays.size + b.extraVisits,
        hours: Math.round(b.hours * 10) / 10,
        photos: b.photos,
        activities: b.activities,
      }))
      .filter((a) => a.visits > 0 || a.hours > 0 || a.photos > 0 || a.activities > 0)
      .sort(
        (x, y) =>
          y.visits + y.photos + y.activities - (x.visits + x.photos + x.activities),
      );
  }
}
