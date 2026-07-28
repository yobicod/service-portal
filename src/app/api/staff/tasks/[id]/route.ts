import { NextRequest, NextResponse } from "next/server";
import { ReportStatus, Role, TaskStatus } from "@/generated/prisma/client";
import { getActor, isResponse, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { nextReportStatusForStaffAction, nextTaskStatusForStaffAction, StaffAction } from "@/lib/workflow";
import { requireWorkflowClaim, WorkflowConflictError } from "@/lib/workflow-mutation";

function currentReportStatusForTask(status: TaskStatus) {
  if (status === TaskStatus.ASSIGNED) return ReportStatus.ASSIGNED;
  if (status === TaskStatus.NEEDS_REVISION) return ReportStatus.NEEDS_REVISION;
  return ReportStatus.IN_PROGRESS;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor(request, [Role.STAFF]);
  if (isResponse(actor)) return actor;
  const { id } = await context.params;
  const body = await request.json();
  const task = await prisma.maintenanceTask.findUnique({ where: { id } });
  if (!task) return jsonError("Task not found.", 404);
  if (task.assignedStaffId !== actor.id) return jsonError("This task is assigned to another staff member.", 403);
  if (!["start", "progress", "complete"].includes(body.action)) return jsonError("action must be start, progress, or complete.");
  if (body.action === "complete" && (typeof body.note !== "string" || !body.note.trim())) return jsonError("A completion note is required.");
  const action = body.action as StaffAction;
  const nextTaskStatus = nextTaskStatusForStaffAction(task.status, action);
  if (!nextTaskStatus) return jsonError("This action is not valid for the current task status.", 409);
  const nextReportStatus = nextReportStatusForStaffAction(action);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const taskClaim = await tx.maintenanceTask.updateMany({
        where: { id, status: task.status, assignedStaffId: actor.id },
        data: {
          status: nextTaskStatus,
          progressNote: typeof body.note === "string" ? body.note.trim() : task.progressNote,
          completedNote: body.action === "complete" ? body.note.trim() : task.completedNote,
          completedAt: body.action === "complete" ? new Date() : task.completedAt,
        },
      });
      requireWorkflowClaim(taskClaim);
      const reportClaim = await tx.maintenanceReport.updateMany({
        where: { id: task.reportId, status: currentReportStatusForTask(task.status) },
        data: { status: nextReportStatus },
      });
      requireWorkflowClaim(reportClaim);
      await tx.statusLog.create({ data: { reportId: task.reportId, taskId: task.id, changedById: actor.id, fromStatus: task.status, toStatus: nextReportStatus, comment: typeof body.note === "string" ? body.note.trim() : null } });
      return tx.maintenanceTask.findUniqueOrThrow({ where: { id } });
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof WorkflowConflictError) return jsonError(error.message, 409);
    throw error;
  }
}
