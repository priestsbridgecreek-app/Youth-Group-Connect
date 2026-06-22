import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, lessonsTable, usersTable, activitiesTable } from "@workspace/db";
import { CreateLessonBody, UpdateLessonBody, ListLessonsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function getLessonsWithDetails(groupId: number, from?: string, to?: string) {
  const results = await db
    .select({
      id: lessonsTable.id,
      date: lessonsTable.date,
      title: lessonsTable.title,
      topic: lessonsTable.topic,
      instructorId: lessonsTable.instructorId,
      assistingIds: lessonsTable.assistingIds,
      goalSharingIds: lessonsTable.goalSharingIds,
      activityId: lessonsTable.activityId,
      notes: lessonsTable.notes,
      groupId: lessonsTable.groupId,
      createdAt: lessonsTable.createdAt,
    })
    .from(lessonsTable)
    .where(eq(lessonsTable.groupId, groupId));

  const allUserIds = new Set<number>();
  results.forEach((r) => {
    if (r.instructorId) allUserIds.add(r.instructorId);
    (r.assistingIds ?? []).forEach(id => allUserIds.add(id));
    (r.goalSharingIds ?? []).forEach(id => allUserIds.add(id));
  });

  const userMap: Record<number, string> = {};
  if (allUserIds.size > 0) {
    const users = await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable);
    users.forEach((u) => { userMap[u.id] = `${u.firstName} ${u.lastName}`; });
  }

  const activityIds = results.filter((r) => r.activityId).map((r) => r.activityId!);
  const activityMap: Record<number, string> = {};
  if (activityIds.length > 0) {
    const activities = await db.select({ id: activitiesTable.id, title: activitiesTable.title }).from(activitiesTable);
    activities.forEach((a) => { activityMap[a.id] = a.title; });
  }

  let filtered = results.map((r) => {
    const aIds = r.assistingIds ?? [];
    const gIds = r.goalSharingIds ?? [];
    return {
      id: r.id,
      date: r.date,
      title: r.title,
      topic: r.topic,
      instructorId: r.instructorId,
      instructorName: r.instructorId ? (userMap[r.instructorId] ?? null) : null,
      assistingIds: aIds,
      assistingNames: aIds.map(id => userMap[id]).filter(Boolean),
      goalSharingIds: gIds,
      goalSharingNames: gIds.map(id => userMap[id]).filter(Boolean),
      activityId: r.activityId,
      activityTitle: r.activityId ? (activityMap[r.activityId] ?? null) : null,
      notes: r.notes,
      groupId: r.groupId,
      createdAt: r.createdAt.toISOString(),
    };
  });

  if (from) filtered = filtered.filter((r) => r.date >= from);
  if (to) filtered = filtered.filter((r) => r.date <= to);

  return filtered.sort((a, b) => a.date.localeCompare(b.date));
}

router.get("/lessons", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const qp = ListLessonsQueryParams.safeParse(req.query);
  const { from, to } = qp.success ? qp.data : {};
  const items = await getLessonsWithDetails(currentUser.groupId, from, to);
  res.json(items);
});

router.post("/lessons", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (currentUser.role === "member") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreateLessonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.insert(lessonsTable).values({
    date: parsed.data.date,
    title: parsed.data.title,
    topic: parsed.data.topic,
    groupId: currentUser.groupId,
    instructorId: parsed.data.instructorId ?? null,
    assistingIds: parsed.data.assistingIds ?? [],
    goalSharingIds: parsed.data.goalSharingIds ?? [],
    activityId: parsed.data.activityId ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();

  const all = await getLessonsWithDetails(currentUser.groupId);
  const result = all.find((a) => a.id === item.id);
  res.status(201).json(result);
});

router.patch("/lessons/:id", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (currentUser.role === "member") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = UpdateLessonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { assistingIds, goalSharingIds, ...rest } = parsed.data;

  await db.update(lessonsTable)
    .set({
      ...rest,
      assistingIds: assistingIds ?? [],
      goalSharingIds: goalSharingIds ?? [],
    })
    .where(and(eq(lessonsTable.id, id), eq(lessonsTable.groupId, currentUser.groupId)));

  const all = await getLessonsWithDetails(currentUser.groupId);
  const result = all.find((a) => a.id === id);
  res.json(result);
});

router.delete("/lessons/:id", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (currentUser.role === "member") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(lessonsTable).where(and(eq(lessonsTable.id, id), eq(lessonsTable.groupId, currentUser.groupId)));
  res.status(204).end();
});

export default router;
