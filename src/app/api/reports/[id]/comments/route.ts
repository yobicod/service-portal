import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { getActor, isResponse, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor(request);
  if (isResponse(actor)) return actor;
  const { id: reportId } = await context.params;
  const body = await request.json();
  if (typeof body.message !== "string" || !body.message.trim()) return jsonError("A comment message is required.");
  const report = await prisma.maintenanceReport.findUnique({ where: { id: reportId }, select: { reporterId: true, tasks: { select: { assignedStaffId: true } } } });
  if (!report) return jsonError("Report not found.", 404);
  if (actor.role === Role.USER && report.reporterId !== actor.id) return jsonError("You do not have access to this report.", 403);
  if (actor.role === Role.STAFF && !report.tasks.some((task) => task.assignedStaffId === actor.id)) return jsonError("You do not have access to this report.", 403);
  const comment = await prisma.comment.create({ data: { reportId, authorId: actor.id, message: body.message.trim() } });
  return NextResponse.json({ data: comment }, { status: 201 });
}
