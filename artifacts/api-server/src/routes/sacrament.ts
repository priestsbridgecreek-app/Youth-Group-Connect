import { Router } from "express";
import { eq, and, ne, sql } from "drizzle-orm";
import { db, sacramentRotationsTable, sacramentRotationMembersTable, usersTable } from "@workspace/db";
import {
  CreateSacramentRotationBody,
  UpdateSacramentRotationBody,
  ListSacramentRotationsQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function getRotationsWithMembers(groupId: number, from?: string, to?: string) {
  const rotations = await db
    .select()
    .from(sacramentRotationsTable)
    .where(eq(sacramentRotationsTable.groupId, groupId));

  const rotationIds = rotations.map((r) => r.id);
  if (rotationIds.length === 0) return [];

  const memberRows = await db
    .select({
      rotationId: sacramentRotationMembersTable.rotationId,
      userId: sacramentRotationMembersTable.userId,
      role: sacramentRotationMembersTable.role,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(sacramentRotationMembersTable)
    .innerJoin(usersTable, eq(sacramentRotationMembersTable.userId, usersTable.id));

  let result = rotations.map((r) => ({
    id: r.id,
    date: r.date,
    groupId: r.groupId,
    members: memberRows
      .filter((m) => m.rotationId === r.id)
      .map((m) => ({
        userId: m.userId,
        firstName: m.firstName,
        lastName: m.lastName,
        role: m.role,
      })),
    createdAt: r.createdAt.toISOString(),
  }));

  if (from) result = result.filter((r) => r.date >= from);
  if (to) result = result.filter((r) => r.date <= to);

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

router.get("/sacrament-rotations", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const qp = ListSacramentRotationsQueryParams.safeParse(req.query);
  const { from, to } = qp.success ? qp.data : {};
  const items = await getRotationsWithMembers(currentUser.groupId, from, to);
  res.json(items);
});

router.get("/sacrament-rotations/randomize", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;

  // Get active non-leader members of current group
  const activeMembers = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(usersTable)
    .where(and(
      eq(usersTable.groupId, currentUser.groupId),
      eq(usersTable.status, "active"),
      ne(usersTable.role, "leader"),
    ));

  if (activeMembers.length === 0) {
    res.json({ members: [] });
    return;
  }

  // Get recent rotation members to avoid repeating (last 4 rotations)
  const recentRotations = await db
    .select()
    .from(sacramentRotationsTable)
    .where(eq(sacramentRotationsTable.groupId, currentUser.groupId))
    .orderBy(sql`${sacramentRotationsTable.date} DESC`)
    .limit(4);

  const recentMemberIds = new Set<number>();
  if (recentRotations.length > 0) {
    const recentIds = recentRotations.map((r) => r.id);
    const recentMembers = await db
      .select()
      .from(sacramentRotationMembersTable)
      .where(sql`${sacramentRotationMembersTable.rotationId} = ANY(${sql.raw(`ARRAY[${recentIds.join(",")}]`)})`);
    recentMembers.forEach((m) => recentMemberIds.add(m.userId));
  }

  // Prefer members who haven't been recently assigned
  const preferred = activeMembers.filter((m) => !recentMemberIds.has(m.id));
  const fallback = activeMembers.filter((m) => recentMemberIds.has(m.id));

  const pool = preferred.length >= 3 ? preferred : [...preferred, ...fallback];

  // Shuffle and pick 3
  const shuffled = pool.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(3, shuffled.length));

  res.json({
    members: selected.map((m) => ({
      userId: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      role: null,
    })),
  });
});

router.post("/sacrament-rotations", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (currentUser.role === "member") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreateSacramentRotationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [rotation] = await db.insert(sacramentRotationsTable).values({
    date: parsed.data.date,
    groupId: currentUser.groupId,
  }).returning();

  if (parsed.data.memberIds.length > 0) {
    await db.insert(sacramentRotationMembersTable).values(
      parsed.data.memberIds.map((userId) => ({
        rotationId: rotation.id,
        userId,
        role: null,
      }))
    );
  }

  const all = await getRotationsWithMembers(currentUser.groupId);
  const result = all.find((r) => r.id === rotation.id);
  res.status(201).json(result);
});

router.patch("/sacrament-rotations/:id", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (currentUser.role === "member") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = UpdateSacramentRotationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.date) {
    await db.update(sacramentRotationsTable)
      .set({ date: parsed.data.date })
      .where(and(eq(sacramentRotationsTable.id, id), eq(sacramentRotationsTable.groupId, currentUser.groupId)));
  }

  if (parsed.data.memberIds) {
    await db.delete(sacramentRotationMembersTable).where(eq(sacramentRotationMembersTable.rotationId, id));
    if (parsed.data.memberIds.length > 0) {
      await db.insert(sacramentRotationMembersTable).values(
        parsed.data.memberIds.map((userId) => ({ rotationId: id, userId, role: null }))
      );
    }
  }

  const all = await getRotationsWithMembers(currentUser.groupId);
  const result = all.find((r) => r.id === id);
  res.json(result);
});

router.delete("/sacrament-rotations/:id", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (currentUser.role === "member") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(sacramentRotationMembersTable).where(eq(sacramentRotationMembersTable.rotationId, id));
  await db.delete(sacramentRotationsTable).where(
    and(eq(sacramentRotationsTable.id, id), eq(sacramentRotationsTable.groupId, currentUser.groupId))
  );
  res.status(204).end();
});

export default router;
