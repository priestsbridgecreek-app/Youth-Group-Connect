import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, substitutionRequestsTable, usersTable, sacramentRotationsTable, sacramentRotationMembersTable } from "@workspace/db";
import { CreateSubstitutionRequestBody, UpdateSubstitutionRequestBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function getRequestsWithDetails(groupId: number) {
  const requests = await db
    .select({
      id: substitutionRequestsTable.id,
      rotationId: substitutionRequestsTable.rotationId,
      requesterId: substitutionRequestsTable.requesterId,
      reason: substitutionRequestsTable.reason,
      status: substitutionRequestsTable.status,
      groupId: substitutionRequestsTable.groupId,
      createdAt: substitutionRequestsTable.createdAt,
    })
    .from(substitutionRequestsTable)
    .where(eq(substitutionRequestsTable.groupId, groupId));

  const userIds = [...new Set(requests.map((r) => r.requesterId))];
  const rotationIds = [...new Set(requests.map((r) => r.rotationId))];

  const userMap: Record<number, string> = {};
  if (userIds.length > 0) {
    const users = await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName }).from(usersTable);
    users.forEach((u) => { userMap[u.id] = `${u.firstName} ${u.lastName}`; });
  }

  const rotationDateMap: Record<number, string> = {};
  if (rotationIds.length > 0) {
    const rotations = await db.select({ id: sacramentRotationsTable.id, date: sacramentRotationsTable.date }).from(sacramentRotationsTable);
    rotations.forEach((r) => { rotationDateMap[r.id] = r.date; });
  }

  return requests.map((r) => ({
    id: r.id,
    rotationId: r.rotationId,
    rotationDate: rotationDateMap[r.rotationId] ?? null,
    requesterId: r.requesterId,
    requesterName: userMap[r.requesterId] ?? "",
    reason: r.reason,
    status: r.status,
    groupId: r.groupId,
    createdAt: r.createdAt.toISOString(),
  }));
}

router.get("/substitution-requests", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const items = await getRequestsWithDetails(currentUser.groupId);
  res.json(items);
});

router.post("/substitution-requests", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;

  const parsed = CreateSubstitutionRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.insert(substitutionRequestsTable).values({
    rotationId: parsed.data.rotationId,
    requesterId: currentUser.id,
    reason: parsed.data.reason ?? null,
    status: "pending",
    groupId: currentUser.groupId,
  }).returning();

  const all = await getRequestsWithDetails(currentUser.groupId);
  const result = all.find((r) => r.id === item.id);
  res.status(201).json(result);
});

router.patch("/substitution-requests/:id", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (currentUser.role === "member") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = UpdateSubstitutionRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.update(substitutionRequestsTable)
    .set({ status: parsed.data.status })
    .where(and(eq(substitutionRequestsTable.id, id), eq(substitutionRequestsTable.groupId, currentUser.groupId)));

  const all = await getRequestsWithDetails(currentUser.groupId);
  const result = all.find((r) => r.id === id);
  res.json(result);
});

router.post("/substitution-requests/:id/accept", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [subReq] = await db
    .select()
    .from(substitutionRequestsTable)
    .where(and(
      eq(substitutionRequestsTable.id, id),
      eq(substitutionRequestsTable.groupId, currentUser.groupId),
      eq(substitutionRequestsTable.status, "pending")
    ));

  if (!subReq) {
    res.status(404).json({ error: "Request not found or already handled" });
    return;
  }

  if (subReq.requesterId === currentUser.id) {
    res.status(400).json({ error: "Cannot accept your own substitution request" });
    return;
  }

  // Swap the requester out of the rotation — replace with the accepting user
  await db
    .update(sacramentRotationMembersTable)
    .set({ userId: currentUser.id })
    .where(and(
      eq(sacramentRotationMembersTable.rotationId, subReq.rotationId),
      eq(sacramentRotationMembersTable.userId, subReq.requesterId)
    ));

  await db
    .update(substitutionRequestsTable)
    .set({ status: "resolved" })
    .where(eq(substitutionRequestsTable.id, id));

  const all = await getRequestsWithDetails(currentUser.groupId);
  const result = all.find((r) => r.id === id);
  res.json(result);
});

export default router;
