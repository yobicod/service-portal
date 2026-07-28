import { NextRequest, NextResponse } from "next/server";
import { ReportStatus, Role } from "@/generated/prisma/client";
import { getActor, isResponse, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { AdminVerificationAction, canVerifyTask, nextReportStatusForVerification, nextTaskStatusForVerification } from "@/lib/workflow";
import { requireWorkflowClaim, WorkflowConflictError } from "@/lib/workflow-mutation";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor(request, [Role.ADMIN]);
  if (isResponse(actor)) return actor;
  const { id } = await context.params;
  const body = await request.json();
  if (!["close", "revision"].includes(body.action)) return jsonError("action must be close or revision.");
  if (typeof body.note !== "string" || !body.note.trim()) return jsonError("A verification note is required.");
  const task = await prisma.maintenanceTask.findUnique({ where: { id } });
  if (!task) return jsonError("Task not found.", 404);
  if (!canVerifyTask(task.status)) return jsonError("Only completed tasks can be verified.", 409);
  const action = body.action as AdminVerificationAction;
  const nextTaskStatus = nextTaskStatusForVerification(action);
  const nextReportStatus = nextReportStatusForVerification(action);
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const taskClaim = await tx.maintenanceTask.updateMany({
        where: { id, status: task.status },
        data: { status: nextTaskStatus, adminCloseNote: body.note.trim(), closedAt: body.action === "close" ? new Date() : null },
      });
      requireWorkflowClaim(taskClaim);
      const reportClaim = await tx.maintenanceReport.updateMany({
        where: { id: task.reportId, status: ReportStatus.COMPLETED_BY_STAFF },
        data: { status: nextReportStatus },
      });
      requireWorkflowClaim(reportClaim);
      await tx.statusLog.create({ data: { reportId: task.reportId, taskId: id, changedById: actor.id, fromStatus: task.status, toStatus: nextReportStatus, comment: body.note.trim() } });
      return tx.maintenanceTask.findUniqueOrThrow({ where: { id } });
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof WorkflowConflictError) return jsonError(error.message, 409);
    throw error;
  }
}
