import { pgTable, text, serial, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable, groupsTable } from "./users";
import { activitiesTable } from "./activities";

export const scheduledActivitiesTable = pgTable("scheduled_activities", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  activityId: integer("activity_id").notNull().references(() => activitiesTable.id),
  personInChargeId: integer("person_in_charge_id").references(() => usersTable.id),
  treatsAssigneeId: integer("treats_assignee_id").references(() => usersTable.id),
  location: text("location"),
  equipment: text("equipment"),
  notes: text("notes"),
  groupId: integer("group_id").notNull().references(() => groupsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScheduledActivitySchema = createInsertSchema(scheduledActivitiesTable).omit({ id: true, createdAt: true });
export type InsertScheduledActivity = z.infer<typeof insertScheduledActivitySchema>;
export type ScheduledActivity = typeof scheduledActivitiesTable.$inferSelect;
