import { pgTable, text, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable, groupsTable } from "./users";
import { sacramentRotationsTable } from "./sacramentRotations";

export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "denied", "resolved"]);

export const substitutionRequestsTable = pgTable("substitution_requests", {
  id: serial("id").primaryKey(),
  rotationId: integer("rotation_id").notNull().references(() => sacramentRotationsTable.id),
  requesterId: integer("requester_id").notNull().references(() => usersTable.id),
  reason: text("reason"),
  status: requestStatusEnum("status").notNull().default("pending"),
  groupId: integer("group_id").notNull().references(() => groupsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubstitutionRequestSchema = createInsertSchema(substitutionRequestsTable).omit({ id: true, createdAt: true });
export type InsertSubstitutionRequest = z.infer<typeof insertSubstitutionRequestSchema>;
export type SubstitutionRequest = typeof substitutionRequestsTable.$inferSelect;
