import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { getActor, isResponse, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor(request);
  if (isResponse(actor)) return actor;
  const { id } = await context.params;
  const report = await prisma.maintenanceReport.findUnique({
    where: { id },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      tasks: { include: { assignedStaff: { select: { id: true, name: true } }, attachments: true } },
      attachments: true,
      comments: { include: { author: { select: { id: true, name: true, role: true } }, attachments: true }, orderBy: { createdAt: "asc" } },
      statusLogs: { include: { changedBy: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!report) return jsonError("Report not found.", 404);
  if (actor.role === Role.USER && report.reporterId !== actor.id) return jsonError("You do not have access to this report.", 403);
  if (actor.role === Role.STAFF && !report.tasks.some((task) => task.assignedStaffId === actor.id)) return jsonError("You do not have access to this report.", 403);
  return NextResponse.json({ data: report });
}
