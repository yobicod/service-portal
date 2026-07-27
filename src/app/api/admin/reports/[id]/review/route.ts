import { NextRequest, NextResponse } from "next/server";
import { Priority, ReportStatus, Role } from "@/generated/prisma/client";
import { getActor, isResponse, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canReviewReport } from "@/lib/workflow";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor(request, [Role.ADMIN]);
  if (isResponse(actor)) return actor;
  const { id } = await context.params;
  const body = await request.json();
  const report = await prisma.maintenanceReport.findUnique({ where: { id } });
  if (!report) return jsonError("Report not found.", 404);
  if (!canReviewReport(report.status)) return jsonError("Only new reports can be reviewed.", 409);
  if (!["approve", "reject"].includes(body.action)) return jsonError("action must be approve or reject.");
  if (body.action === "reject" && (typeof body.reason !== "string" || !body.reason.trim())) return jsonError("A rejection reason is required.");
  if (body.priority && !Object.values(Priority).includes(body.priority)) return jsonError("Invalid priority.");
  const nextStatus = body.action === "approve" ? ReportStatus.APPROVED : ReportStatus.REJECTED;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.maintenanceReport.update({ where: { id }, data: { status: nextStatus, priority: body.priority ?? report.priority, rejectReason: body.action === "reject" ? body.reason.trim() : null, internalNote: typeof body.internalNote === "string" ? body.internalNote.trim() : report.internalNote } });
    await tx.statusLog.create({ data: { reportId: id, changedById: actor.id, fromStatus: report.status, toStatus: nextStatus, comment: body.action === "reject" ? body.reason.trim() : "Report approved." } });
    return result;
  });
  return NextResponse.json({ data: updated });
}
