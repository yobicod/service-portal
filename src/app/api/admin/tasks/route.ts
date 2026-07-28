import { NextRequest, NextResponse } from "next/server";
import { Priority, ReportStatus, Role, TaskStatus } from "@/generated/prisma/client";
import { getActor, isResponse, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canAssignReport } from "@/lib/workflow";
import { requireWorkflowClaim, WorkflowConflictError } from "@/lib/workflow-mutation";

export async function POST(request: NextRequest) {
  const actor = await getActor(request, [Role.ADMIN]);
  if (isResponse(actor)) return actor;
  const body = await request.json();
  if (typeof body.reportId !== "string" || typeof body.assignedStaffId !== "string") return jsonError("reportId and assignedStaffId are required.");
  const [report, staff] = await Promise.all([prisma.maintenanceReport.findUnique({ where: { id: body.reportId } }), prisma.user.findUnique({ where: { id: body.assignedStaffId } })]);
  if (!report) return jsonError("Report not found.", 404);
  if (!canAssignReport(report.status)) return jsonError("Only approved reports can be assigned.", 409);
  if (!staff || staff.role !== Role.STAFF) return jsonError("The assigned user must be a staff member.");
  const dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.valueOf())) return jsonError("Invalid dueDate.");
  if (body.priority && !Object.values(Priority).includes(body.priority)) return jsonError("Invalid priority.");
  const estimatedCost = body.estimatedCost === undefined || body.estimatedCost === "" ? null : Number(body.estimatedCost);
  if (estimatedCost !== null && (!Number.isFinite(estimatedCost) || estimatedCost < 0)) return jsonError("estimatedCost must be a non-negative number.");

  try {
    const task = await prisma.$transaction(async (tx) => {
      const claim = await tx.maintenanceReport.updateMany({
        where: { id: report.id, status: report.status },
        data: { status: ReportStatus.ASSIGNED, priority: body.priority ?? report.priority },
      });
      requireWorkflowClaim(claim);
      const created = await tx.maintenanceTask.create({ data: { reportId: report.id, assignedStaffId: staff.id, assignedByAdminId: actor.id, instruction: typeof body.instruction === "string" ? body.instruction.trim() : null, dueDate, estimatedCost: estimatedCost === null ? null : String(estimatedCost), status: TaskStatus.ASSIGNED } });
      await tx.statusLog.create({ data: { reportId: report.id, taskId: created.id, changedById: actor.id, fromStatus: report.status, toStatus: ReportStatus.ASSIGNED, comment: "Task assigned to staff." } });
      return created;
    });
    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkflowConflictError) return jsonError(error.message, 409);
    throw error;
  }
}
