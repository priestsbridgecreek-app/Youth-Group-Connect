import { Router } from "express";
import { eq, and, gte, sql } from "drizzle-orm";
import {
  db,
  scheduledActivitiesTable,
  activitiesTable,
  lessonsTable,
  sacramentRotationsTable,
  sacramentRotationMembersTable,
  substitutionRequestsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const today = new Date().toISOString().split("T")[0];

  // Upcoming scheduled activities (next 4 weeks)
  const upcomingActivitiesRaw = await db
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
    .where(and(
      eq(scheduledActivitiesTable.groupId, currentUser.groupId),
      gte(scheduledActivitiesTable.date, today)
    ))
    .limit(5);

  // Get user names for activities
  const allUsers = await db
    .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable)
    .where(eq(usersTable.groupId, currentUser.groupId));
  const userMap: Record<number, string> = {};
  allUsers.forEach((u) => { userMap[u.id] = `${u.firstName} ${u.lastName}`; });

  const upcomingActivities = upcomingActivitiesRaw
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
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

  // Upcoming sacrament rotations (next 4 weeks)
  const upcomingRotationsRaw = await db
    .select()
    .from(sacramentRotationsTable)
    .where(and(
      eq(sacramentRotationsTable.groupId, currentUser.groupId),
      gte(sacramentRotationsTable.date, today)
    ))
    .limit(5);

  const rotationIds = upcomingRotationsRaw.map((r) => r.id);
  let memberRows: any[] = [];
  if (rotationIds.length > 0) {
    memberRows = await db
      .select({
        rotationId: sacramentRotationMembersTable.rotationId,
        userId: sacramentRotationMembersTable.userId,
        role: sacramentRotationMembersTable.role,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      })
      .from(sacramentRotationMembersTable)
      .innerJoin(usersTable, eq(sacramentRotationMembersTable.userId, usersTable.id))
      .where(sql`${sacramentRotationMembersTable.rotationId} = ANY(${sql.raw(`ARRAY[${rotationIds.join(",")}]`)})`);
  }

  const upcomingRotations = upcomingRotationsRaw
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      id: r.id,
      date: r.date,
      groupId: r.groupId,
      members: memberRows
        .filter((m) => m.rotationId === r.id)
        .map((m) => ({ userId: m.userId, firstName: m.firstName, lastName: m.lastName, role: m.role })),
      createdAt: r.createdAt.toISOString(),
    }));

  // Upcoming lessons
  const upcomingLessonsRaw = await db
    .select({
      id: lessonsTable.id,
      date: lessonsTable.date,
      title: lessonsTable.title,
      topic: lessonsTable.topic,
      instructorId: lessonsTable.instructorId,
      activityId: lessonsTable.activityId,
      location: lessonsTable.location,
      notes: lessonsTable.notes,
      groupId: lessonsTable.groupId,
      createdAt: lessonsTable.createdAt,
    })
    .from(lessonsTable)
    .where(and(
      eq(lessonsTable.groupId, currentUser.groupId),
      gte(lessonsTable.date, today)
    ))
    .limit(5);

  const upcomingLessons = upcomingLessonsRaw
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      id: r.id,
      date: r.date,
      title: r.title,
      topic: r.topic,
      instructorId: r.instructorId,
      instructorName: r.instructorId ? (userMap[r.instructorId] ?? null) : null,
      activityId: r.activityId,
      activityTitle: null,
      location: r.location,
      notes: r.notes,
      groupId: r.groupId,
      createdAt: r.createdAt.toISOString(),
    }));

  // Pending substitution requests
  const pendingReqs = await db
    .select()
    .from(substitutionRequestsTable)
    .where(and(
      eq(substitutionRequestsTable.groupId, currentUser.groupId),
      eq(substitutionRequestsTable.status, "pending")
    ));

  // My assignments
  const myActivityIds = upcomingActivitiesRaw
    .filter((a) => a.personInChargeId === currentUser.id || a.treatsAssigneeId === currentUser.id)
    .map((a) => a.id);

  const myRotationIds = upcomingRotations
    .filter((r) => r.members.some((m) => m.userId === currentUser.id))
    .map((r) => r.id);

  const myLessonIds = upcomingLessonsRaw
    .filter((l) => l.instructorId === currentUser.id)
    .map((l) => l.id);

  res.json({
    upcomingActivities,
    upcomingRotations,
    upcomingLessons,
    pendingRequests: pendingReqs.length,
    myAssignments: {
      activities: myActivityIds,
      rotations: myRotationIds,
      lessons: myLessonIds,
    },
  });
});

export default router;
