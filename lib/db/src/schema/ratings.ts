import {
  pgTable,
  serial,
  integer,
  doublePrecision,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { neighborhoodsTable } from "./neighborhoods";
import { traitsTable } from "./traits";

export const ratingsTable = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    neighborhoodId: integer("neighborhood_id")
      .notNull()
      .references(() => neighborhoodsTable.id),
    traitId: integer("trait_id")
      .notNull()
      .references(() => traitsTable.id),
    rating: doublePrecision("rating").notNull().default(1500),
    gamesPlayed: integer("games_played").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    draws: integer("draws").notNull().default(0),
  },
  (t) => [uniqueIndex("ratings_neighborhood_trait_idx").on(t.neighborhoodId, t.traitId)],
);

export const insertRatingSchema = createInsertSchema(ratingsTable).omit({
  id: true,
});
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratingsTable.$inferSelect;
