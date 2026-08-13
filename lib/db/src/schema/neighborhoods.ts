import {
  pgTable,
  text,
  serial,
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
});

export const insertNeighborhoodSchema = createInsertSchema(
  neighborhoodsTable,
).omit({ id: true });
export type InsertNeighborhood = z.infer<typeof insertNeighborhoodSchema>;
export type Neighborhood = typeof neighborhoodsTable.$inferSelect;
