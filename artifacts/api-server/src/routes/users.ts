import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, usersTable, groupsTable, lessonsTable } from "@workspace/db";
import { InviteUserBody, UpdateUserBody, ResetAccessCodeBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function generateAccessCode(firstName: string, lastName: string): string {
  const initials = (
    (firstName[0] ?? "X") + (lastName[0] ?? "X")
  ).toUpperCase();
  const digits = Math.floor(1000 + Math.random() * 9000).toString();
  return `${initials}${digits}`;
}

function isPresidencyOrLeader(role: string): boolean {
  return role === "presidency" || role === "leader";
}

function sanitizeUserForViewer<T extends { excludeFromSacrament: boolean }>(
  user: T,
  viewerRole: string
): Omit<T, "excludeFromSacrament"> & { excludeFromSacrament?: boolean } {
  if (isPresidencyOrLeader(viewerRole)) return user;
  const { excludeFromSacrament, ...rest } = user;
  return rest;
}

async function getUserWithGroup(userId: number) {
  const rows = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      status: usersTable.status,
      groupId: usersTable.groupId,
      groupName: groupsTable.name,
      accessCode: usersTable.accessCode,
      excludeFromSacrament: usersTable.excludeFromSacrament,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .innerJoin(groupsTable, eq(usersTable.groupId, groupsTable.id))
    .where(eq(usersTable.id, userId));
  return rows[0] ?? null;
}

router.get("/users", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const rows = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      status: usersTable.status,
      groupId: usersTable.groupId,
      groupName: groupsTable.name,
      accessCode: usersTable.accessCode,
      excludeFromSacrament: usersTable.excludeFromSacrament,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .innerJoin(groupsTable, eq(usersTable.groupId, groupsTable.id))
    .where(eq(usersTable.groupId, currentUser.groupId));
  res.json(rows.map((r) => sanitizeUserForViewer(r, currentUser.role)));
});

router.post("/users/invite", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (currentUser.role === "member") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = InviteUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { firstName, lastName, role, customAccessCode, excludeFromSacrament } = parsed.data;
  let accessCode = customAccessCode ?? generateAccessCode(firstName, lastName);
  accessCode = accessCode.toUpperCase();

  // Ensure uniqueness
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.select().from(usersTable).where(eq(usersTable.accessCode, accessCode));
    if (existing.length === 0) break;
    accessCode = generateAccessCode(firstName, lastName);
    attempts++;
  }

  const [newUser] = await db.insert(usersTable).values({
    firstName,
    lastName,
    role: role ?? "member",
    status: "active",
    groupId: currentUser.groupId,
    accessCode,
    excludeFromSacrament: excludeFromSacrament ?? false,
  }).returning();

  const userWithGroup = await getUserWithGroup(newUser.id);
  res.status(201).json(userWithGroup);
});

router.get("/users/:userId", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);

  const user = await getUserWithGroup(userId);
  if (!user || user.groupId !== currentUser.groupId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(sanitizeUserForViewer(user, currentUser.role));
});

router.patch("/users/:userId", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);

  const isSelf = userId === currentUser.id;
  const isLeader = currentUser.role === "leader";
  const isPresidency = isPresidencyOrLeader(currentUser.role);

  // Anyone can edit their own record; leaders/presidency can edit others
  if (!isSelf && !isPresidency) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  // Name fields — allowed for self or leader
  if ((isSelf || isLeader) && parsed.data.firstName?.trim()) updates.firstName = parsed.data.firstName.trim();
  if ((isSelf || isLeader) && parsed.data.lastName?.trim()) updates.lastName = parsed.data.lastName.trim();
  // Role/status/group — leaders only
  if (isLeader) {
    if (parsed.data.role) updates.role = parsed.data.role;
    if (parsed.data.status) updates.status = parsed.data.status;
    if (parsed.data.groupId !== undefined) updates.groupId = parsed.data.groupId ?? currentUser.groupId;
  }
  // Sacrament rotation exclusion — leaders/presidency only, never the member themselves
  if (isPresidency && parsed.data.excludeFromSacrament !== undefined) {
    updates.excludeFromSacrament = parsed.data.excludeFromSacrament;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
  const user = await getUserWithGroup(userId);
  res.json(sanitizeUserForViewer(user!, currentUser.role));
});

router.delete("/users/:userId", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (currentUser.role !== "leader") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);
  if (userId === currentUser.id) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }
  const target = await getUserWithGroup(userId);
  if (!target || target.groupId !== currentUser.groupId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    // Remove user from lesson array columns before deleting
    await db.update(lessonsTable)
      .set({ assistingIds: sql`array_remove(${lessonsTable.assistingIds}, ${userId})` })
      .where(eq(lessonsTable.groupId, currentUser.groupId));
    await db.update(lessonsTable)
      .set({ goalSharingIds: sql`array_remove(${lessonsTable.goalSharingIds}, ${userId})` })
      .where(eq(lessonsTable.groupId, currentUser.groupId));
    await db.delete(usersTable).where(and(eq(usersTable.id, userId), eq(usersTable.groupId, currentUser.groupId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete user");
    res.status(500).json({ error: "Failed to delete user" });
  }
});

router.post("/users/:userId/reset-code", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);

  // Users can reset their own code; leaders/presidency can reset others
  if (userId !== currentUser.id && currentUser.role === "member") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = ResetAccessCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const targetUser = await getUserWithGroup(userId);
  if (!targetUser) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  let newCode = parsed.data.customCode ?? generateAccessCode(targetUser.firstName, targetUser.lastName);
  newCode = newCode.toUpperCase();

  await db.update(usersTable).set({ accessCode: newCode }).where(eq(usersTable.id, userId));
  const updated = await getUserWithGroup(userId);
  res.json(updated);
});

export default router;
