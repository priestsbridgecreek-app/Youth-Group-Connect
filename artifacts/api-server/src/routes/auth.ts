import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, groupsTable } from "@workspace/db";
import { LoginBody } from "@workspace/api-zod";

const router = Router();

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
    })
    .from(usersTable)
    .innerJoin(groupsTable, eq(usersTable.groupId, groupsTable.id))
    .where(eq(usersTable.id, userId));
  return rows[0] ?? null;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { accessCode } = parsed.data;
  // Normalize: strip dashes so "JP100001" and "JP-100001" both work
  const normalized = accessCode.trim().toUpperCase().replace(/-/g, "");
  const rows = await db
    .select()
    .from(usersTable)
    .where(sql`REPLACE(${usersTable.accessCode}, '-', '') = ${normalized}`);

  const user = rows[0];
  if (!user || user.status === "archived") {
    res.status(401).json({ error: "Invalid access code" });
    return;
  }

  (req.session as any).userId = user.id;
  const userWithGroup = await getUserWithGroup(user.id);
  res.json(userWithGroup);
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const user = await getUserWithGroup(userId);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

export default router;
