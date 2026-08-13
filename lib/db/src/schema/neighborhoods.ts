import {
  pgTable,
  text,
  serial,
  integer,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const neighborhoodsTable = pgTable("neighborhoods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  borough: text("borough").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  photoUrl: text("photo_url"),
  blurb: text("blurb"),
  /**
   * Notoriety tier used to weight matchup selection:
   * 8 = iconic, 4 = well-known, 2 = average, 1 = low-profile.
   */
  popularity: integer("popularity").notNull().default(2),
});

export const insertNeighborhoodSchema = createInsertSchema(
  neighborhoodsTable,
).omit({ id: true });
export type InsertNeighborhood = z.infer<typeof insertNeighborhoodSchema>;
export type Neighborhood = typeof neighborhoodsTable.$inferSelect;
