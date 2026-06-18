import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, groupsTable } from "@workspace/db";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

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

  const user = rows[0];
  if (!user || user.status === "archived") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  (req as any).currentUser = user;
  next();
}
