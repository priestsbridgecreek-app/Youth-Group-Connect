import { pgTable, text, serial, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable, groupsTable } from "./users";

export const sacramentRotationsTable = pgTable("sacrament_rotations", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sacramentRotationMembersTable = pgTable("sacrament_rotation_members", {
  id: serial("id").primaryKey(),
  rotationId: integer("rotation_id").notNull().references(() => sacramentRotationsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  role: text("role"), // "officiant", "blessing", etc. — optional label
});

export const insertSacramentRotationSchema = createInsertSchema(sacramentRotationsTable).omit({ id: true, createdAt: true });
export type InsertSacramentRotation = z.infer<typeof insertSacramentRotationSchema>;
export type SacramentRotation = typeof sacramentRotationsTable.$inferSelect;
export type SacramentRotationMember = typeof sacramentRotationMembersTable.$inferSelect;
