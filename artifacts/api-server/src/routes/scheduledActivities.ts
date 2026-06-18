import { Router } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, scheduledActivitiesTable, activitiesTable, usersTable } from "@workspace/db";
import {
  CreateScheduledActivityBody,
  UpdateScheduledActivityBody,
  ListScheduledActivitiesQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function getScheduledWithDetails(groupId: number, from?: string, to?: string) {
  let query = db
    .select({
      id: scheduledActivitiesTable.id,
      date: scheduledActivitiesTable.date,
      activityId: scheduledActivitiesTable.activityId,
      activityTitle: activitiesTable.title,
      activityType: activitiesTable.activityType,
      personInChargeId: scheduledActivitiesTable.personInChargeId,
      treatsAssigneeId: scheduledActivitiesTable.treatsAssigneeId,
      location: scheduledActivitiesTable.location,
      equipment: scheduledActivitiesTable.equipment,
      notes: scheduledActivitiesTable.notes,
      groupId: scheduledActivitiesTable.groupId,
      createdAt: scheduledActivitiesTable.createdAt,
    })
    .from(scheduledActivitiesTable)
    .leftJoin(activitiesTable, eq(scheduledActivitiesTable.activityId, activitiesTable.id))
    .where(eq(scheduledActivitiesTable.groupId, groupId));

  const results = await query;

  // Get user names
  const userIds = new Set<number>();
  results.forEach((r) => {
    if (r.personInChargeId) userIds.add(r.personInChargeId);
    if (r.treatsAssigneeId) userIds.add(r.treatsAssigneeId);
  });

  const userMap: Record<number, string> = {};
  if (userIds.size > 0) {
    const users = await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable)
      .where(eq(usersTable.groupId, groupId));
    users.forEach((u) => { userMap[u.id] = `${u.firstName} ${u.lastName}`; });
  }

  let filtered = results.map((r) => ({
    id: r.id,
    date: r.date,
    activityId: r.activityId,
    activityTitle: r.activityTitle ?? "",
    activityType: r.activityType ?? "",
    personInChargeId: r.personInChargeId,
    personInChargeName: r.personInChargeId ? (userMap[r.personInChargeId] ?? null) : null,
    treatsAssigneeId: r.treatsAssigneeId,
    treatsAssigneeName: r.treatsAssigneeId ? (userMap[r.treatsAssigneeId] ?? null) : null,
    location: r.location,
    equipment: r.equipment,
    notes: r.notes,
    groupId: r.groupId,
    createdAt: r.createdAt.toISOString(),
  }));

  if (from) filtered = filtered.filter((r) => r.date >= from);
  if (to) filtered = filtered.filter((r) => r.date <= to);

  return filtered.sort((a, b) => a.date.localeCompare(b.date));
}

router.get("/scheduled-activities", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const qp = ListScheduledActivitiesQueryParams.safeParse(req.query);
  const { from, to } = qp.success ? qp.data : {};
  const items = await getScheduledWithDetails(currentUser.groupId, from, to);
  res.json(items);
});

router.post("/scheduled-activities", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (currentUser.role === "member") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreateScheduledActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.insert(scheduledActivitiesTable).values({
    ...parsed.data,
    groupId: currentUser.groupId,
    personInChargeId: parsed.data.personInChargeId ?? null,
    treatsAssigneeId: parsed.data.treatsAssigneeId ?? null,
    location: parsed.data.location ?? null,
    equipment: parsed.data.equipment ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();

  const all = await getScheduledWithDetails(currentUser.groupId);
  const result = all.find((a) => a.id === item.id);
  res.status(201).json(result);
});

router.patch("/scheduled-activities/:id", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (currentUser.role === "member") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = UpdateScheduledActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.update(scheduledActivitiesTable)
    .set(parsed.data)
    .where(and(eq(scheduledActivitiesTable.id, id), eq(scheduledActivitiesTable.groupId, currentUser.groupId)));

  const all = await getScheduledWithDetails(currentUser.groupId);
  const result = all.find((a) => a.id === id);
  res.json(result);
});

router.delete("/scheduled-activities/:id", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (currentUser.role === "member") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(scheduledActivitiesTable).where(
    and(eq(scheduledActivitiesTable.id, id), eq(scheduledActivitiesTable.groupId, currentUser.groupId))
  );
  res.status(204).end();
});

export default router;
