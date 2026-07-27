import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { createAttachments, validateAttachmentFiles } from "@/lib/attachments";
import { getActor, isResponse, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor(request, [Role.ADMIN, Role.STAFF]);
  if (isResponse(actor)) return actor;
  const { id: taskId } = await context.params;
  const task = await prisma.maintenanceTask.findUnique({ where: { id: taskId }, select: { reportId: true, assignedStaffId: true } });
  if (!task) return jsonError("Task not found.", 404);
  if (actor.role === Role.STAFF && task.assignedStaffId !== actor.id) return jsonError("This task is assigned to another staff member.", 403);
  const formData = await request.formData();
  const result = validateAttachmentFiles(formData.getAll("files"));
  if (!("files" in result)) return jsonError(result.error);
  const attachments = await createAttachments({ reportId: task.reportId, taskId, uploadedById: actor.id, files: result.files });
  return NextResponse.json({ data: attachments }, { status: 201 });
}
