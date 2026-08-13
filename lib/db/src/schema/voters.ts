import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const votersTable = pgTable("voters", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertVoterSchema = createInsertSchema(votersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertVoter = z.infer<typeof insertVoterSchema>;
export type Voter = typeof votersTable.$inferSelect;
