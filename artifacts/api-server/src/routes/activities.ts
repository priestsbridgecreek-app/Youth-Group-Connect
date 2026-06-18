import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, activitiesTable, activityVotesTable, usersTable } from "@workspace/db";
import { CreateActivityBody, UpdateActivityBody, VoteActivityBody, ListActivitiesQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function getActivitiesWithVotes(groupId: number, currentUserId: number, type?: string) {
  const baseActivities = await db
    .select({
      id: activitiesTable.id,
      title: activitiesTable.title,
      description: activitiesTable.description,
      equipmentNeeded: activitiesTable.equipmentNeeded,
      suggestedLocation: activitiesTable.suggestedLocation,
      costEstimate: activitiesTable.costEstimate,
      activityType: activitiesTable.activityType,
      groupId: activitiesTable.groupId,
      createdById: activitiesTable.createdById,
      createdAt: activitiesTable.createdAt,
      createdByFirstName: usersTable.firstName,
      createdByLastName: usersTable.lastName,
    })
    .from(activitiesTable)
    .leftJoin(usersTable, eq(activitiesTable.createdById, usersTable.id))
    .where(
      type
        ? and(eq(activitiesTable.groupId, groupId), eq(activitiesTable.activityType, type))
        : eq(activitiesTable.groupId, groupId)
    );

  // Get vote counts and user vote for each activity
  const activityIds = baseActivities.map((a) => a.id);
  if (activityIds.length === 0) return [];

  const votes = await db
    .select()
    .from(activityVotesTable)
    .where(
      sql`${activityVotesTable.activityId} = ANY(${sql.raw(`ARRAY[${activityIds.join(",")}]`)})`
    );

  return baseActivities.map((activity) => {
    const actVotes = votes.filter((v) => v.activityId === activity.id);
    const userVote = actVotes.find((v) => v.userId === currentUserId)?.vote ?? null;
    return {
      id: activity.id,
      title: activity.title,
      description: activity.description,
      equipmentNeeded: activity.equipmentNeeded,
      suggestedLocation: activity.suggestedLocation,
      costEstimate: activity.costEstimate,
      activityType: activity.activityType,
      groupId: activity.groupId,
      createdById: activity.createdById,
      createdByName: `${activity.createdByFirstName ?? ""} ${activity.createdByLastName ?? ""}`.trim(),
      upvotes: actVotes.filter((v) => v.vote === "up").length,
      downvotes: actVotes.filter((v) => v.vote === "down").length,
      userVote,
      createdAt: activity.createdAt.toISOString(),
    };
  });
}

router.get("/activities", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const qp = ListActivitiesQueryParams.safeParse(req.query);
  const type = qp.success ? qp.data.type : undefined;
  const activities = await getActivitiesWithVotes(currentUser.groupId, currentUser.id, type);
  res.json(activities);
});

router.post("/activities", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const parsed = CreateActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [activity] = await db.insert(activitiesTable).values({
    ...parsed.data,
    groupId: currentUser.groupId,
    createdById: currentUser.id,
  }).returning();

  const all = await getActivitiesWithVotes(currentUser.groupId, currentUser.id);
  const result = all.find((a) => a.id === activity.id);
  res.status(201).json(result);
});

router.get("/activities/:activityId", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.activityId) ? req.params.activityId[0] : req.params.activityId;
  const activityId = parseInt(raw, 10);

  const all = await getActivitiesWithVotes(currentUser.groupId, currentUser.id);
  const activity = all.find((a) => a.id === activityId);
  if (!activity) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(activity);
});

router.patch("/activities/:activityId", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.activityId) ? req.params.activityId[0] : req.params.activityId;
  const activityId = parseInt(raw, 10);

  const parsed = UpdateActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.update(activitiesTable)
    .set(parsed.data)
    .where(and(eq(activitiesTable.id, activityId), eq(activitiesTable.groupId, currentUser.groupId)));

  const all = await getActivitiesWithVotes(currentUser.groupId, currentUser.id);
  const activity = all.find((a) => a.id === activityId);
  res.json(activity);
});

router.delete("/activities/:activityId", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.activityId) ? req.params.activityId[0] : req.params.activityId;
  const activityId = parseInt(raw, 10);

  if (currentUser.role === "member") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(activityVotesTable).where(eq(activityVotesTable.activityId, activityId));
  await db.delete(activitiesTable).where(
    and(eq(activitiesTable.id, activityId), eq(activitiesTable.groupId, currentUser.groupId))
  );
  res.status(204).end();
});

router.post("/activities/:activityId/vote", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.activityId) ? req.params.activityId[0] : req.params.activityId;
  const activityId = parseInt(raw, 10);

  const parsed = VoteActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { vote } = parsed.data;

  if (vote === "none") {
    await db.delete(activityVotesTable).where(
      and(eq(activityVotesTable.activityId, activityId), eq(activityVotesTable.userId, currentUser.id))
    );
  } else {
    const existing = await db
      .select()
      .from(activityVotesTable)
      .where(and(eq(activityVotesTable.activityId, activityId), eq(activityVotesTable.userId, currentUser.id)));

    if (existing.length > 0) {
      await db.update(activityVotesTable)
        .set({ vote })
        .where(and(eq(activityVotesTable.activityId, activityId), eq(activityVotesTable.userId, currentUser.id)));
    } else {
      await db.insert(activityVotesTable).values({
        activityId,
        userId: currentUser.id,
        vote,
      });
    }
  }

  const all = await getActivitiesWithVotes(currentUser.groupId, currentUser.id);
  const activity = all.find((a) => a.id === activityId);
  res.json(activity);
});

export default router;
