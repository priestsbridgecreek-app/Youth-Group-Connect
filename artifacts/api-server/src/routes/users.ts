import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, groupsTable } from "@workspace/db";
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
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .innerJoin(groupsTable, eq(usersTable.groupId, groupsTable.id))
    .where(eq(usersTable.groupId, currentUser.groupId));
  res.json(rows);
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

  const { firstName, lastName, role, customAccessCode } = parsed.data;
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
  res.json(user);
});

router.patch("/users/:userId", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);

  const isSelf = userId === currentUser.id;
  const isLeader = currentUser.role === "leader";

  // Anyone can edit their own record; only leaders can edit others
  if (!isSelf && !isLeader) {
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
  if (parsed.data.firstName?.trim()) updates.firstName = parsed.data.firstName.trim();
  if (parsed.data.lastName?.trim()) updates.lastName = parsed.data.lastName.trim();
  // Role/status/group — leaders only
  if (isLeader) {
    if (parsed.data.role) updates.role = parsed.data.role;
    if (parsed.data.status) updates.status = parsed.data.status;
    if (parsed.data.groupId !== undefined) updates.groupId = parsed.data.groupId ?? currentUser.groupId;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
  const user = await getUserWithGroup(userId);
  res.json(user);
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
