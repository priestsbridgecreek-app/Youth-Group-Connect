import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, scheduledActivitiesTable, activitiesTable, usersTable } from "@workspace/db";

const router = Router();

function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcalDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0].replace(/-/g, "");
}

router.get("/calendar/activities.ics", async (req, res): Promise<void> => {
  const results = await db
    .select({
      id: scheduledActivitiesTable.id,
      date: scheduledActivitiesTable.date,
      activityTitle: activitiesTable.title,
      activityDescription: activitiesTable.description,
      location: scheduledActivitiesTable.location,
      equipment: scheduledActivitiesTable.equipment,
      notes: scheduledActivitiesTable.notes,
      personInChargeId: scheduledActivitiesTable.personInChargeId,
      treatsAssigneeId: scheduledActivitiesTable.treatsAssigneeId,
    })
    .from(scheduledActivitiesTable)
    .leftJoin(activitiesTable, eq(scheduledActivitiesTable.activityId, activitiesTable.id))
    .orderBy(scheduledActivitiesTable.date);

  const personIds = new Set<number>();
  results.forEach((r) => {
    if (r.personInChargeId) personIds.add(r.personInChargeId);
    if (r.treatsAssigneeId) personIds.add(r.treatsAssigneeId);
  });

  const personMap: Record<number, string> = {};
  if (personIds.size > 0) {
    const users = await db
      .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable);
    users.forEach((u) => { personMap[u.id] = `${u.firstName} ${u.lastName}`; });
  }

  const stamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Youth Connect//Youth Group Activities//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Youth Group Activities",
    "X-WR-CALDESC:Scheduled activities for the youth group",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const item of results) {
    const title = item.activityTitle ?? "Youth Group Activity";

    const descParts: string[] = [];
    if (item.activityDescription) descParts.push(item.activityDescription);
    if (item.notes) descParts.push(`Notes: ${item.notes}`);
    if (item.equipment) descParts.push(`Equipment: ${item.equipment}`);
    if (item.personInChargeId && personMap[item.personInChargeId]) {
      descParts.push(`In charge: ${personMap[item.personInChargeId]}`);
    }
    if (item.treatsAssigneeId && personMap[item.treatsAssigneeId]) {
      descParts.push(`Treats: ${personMap[item.treatsAssigneeId]}`);
    }

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:scheduled-activity-${item.id}@youth-connect`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${toIcalDate(item.date)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(item.date)}`);
    lines.push(`SUMMARY:${escapeIcal(title)}`);
    if (item.location) {
      lines.push(`LOCATION:${escapeIcal(item.location)}`);
    }
    if (descParts.length > 0) {
      lines.push(`DESCRIPTION:${escapeIcal(descParts.join("\n"))}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", "inline; filename=youth-group-activities.ics");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(lines.join("\r\n"));
});

export default router;
