import { pgTable, text, serial, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable, groupsTable } from "./users";
import { activitiesTable } from "./activities";

export const lessonsTable = pgTable("lessons", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  instructorId: integer("instructor_id").references(() => usersTable.id),
  assistingId: integer("assisting_id").references(() => usersTable.id),
  goalSharingId: integer("goal_sharing_id").references(() => usersTable.id),
  activityId: integer("activity_id").references(() => activitiesTable.id),
  location: text("location"),
  notes: text("notes"),
  groupId: integer("group_id").notNull().references(() => groupsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLessonSchema = createInsertSchema(lessonsTable).omit({ id: true, createdAt: true });
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Lesson = typeof lessonsTable.$inferSelect;
