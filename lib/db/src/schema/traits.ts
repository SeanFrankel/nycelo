import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const traitsTable = pgTable("traits", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  emojiHint: text("emoji_hint"),
});

export const insertTraitSchema = createInsertSchema(traitsTable).omit({
  id: true,
});
export type InsertTrait = z.infer<typeof insertTraitSchema>;
export type Trait = typeof traitsTable.$inferSelect;
