import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { votersTable } from "./voters";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { neighborhoodsTable } from "./neighborhoods";
import { traitsTable } from "./traits";

export const votesTable = pgTable("votes", {
  id: serial("id").primaryKey(),
  traitId: integer("trait_id")
    .notNull()
    .references(() => traitsTable.id),
  neighborhoodAId: integer("neighborhood_a_id")
    .notNull()
    .references(() => neighborhoodsTable.id),
  neighborhoodBId: integer("neighborhood_b_id")
    .notNull()
    .references(() => neighborhoodsTable.id),
  outcome: text("outcome").notNull(), // a_wins | b_wins | draw | skip
  voterId: integer("voter_id").references(() => votersTable.id),
  weight: doublePrecision("weight").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertVoteSchema = createInsertSchema(votesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votesTable.$inferSelect;
