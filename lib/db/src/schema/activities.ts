import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable, groupsTable } from "./users";

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  equipmentNeeded: text("equipment_needed"),
  suggestedLocation: text("suggested_location"),
  activityType: text("activity_type").notNull().default("general"),
  groupId: integer("group_id").notNull().references(() => groupsTable.id),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activityVotesTable = pgTable("activity_votes", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull().references(() => activitiesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  vote: text("vote").notNull(), // "up" | "down"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, createdAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;
export type ActivityVote = typeof activityVotesTable.$inferSelect;
