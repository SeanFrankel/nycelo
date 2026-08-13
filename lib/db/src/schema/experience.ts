import {
  pgTable,
  serial,
  integer,
  doublePrecision,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { votersTable } from "./voters";
import { neighborhoodsTable } from "./neighborhoods";

export const experienceTable = pgTable(
  "experience",
  {
    id: serial("id").primaryKey(),
    voterId: integer("voter_id")
      .notNull()
      .references(() => votersTable.id),
    neighborhoodId: integer("neighborhood_id")
      .notNull()
      .references(() => neighborhoodsTable.id),
    visits: integer("visits").notNull().default(0),
    hours: doublePrecision("hours").notNull().default(0),
    photos: integer("photos").notNull().default(0),
    activities: integer("activities").notNull().default(0),
    checkins: integer("checkins").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("experience_voter_neighborhood_idx").on(
      t.voterId,
      t.neighborhoodId,
    ),
  ],
);

export const insertExperienceSchema = createInsertSchema(
  experienceTable,
).omit({ id: true, updatedAt: true });
export type InsertExperience = z.infer<typeof insertExperienceSchema>;
export type Experience = typeof experienceTable.$inferSelect;
