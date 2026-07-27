import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { createAttachments, validateAttachmentFiles } from "@/lib/attachments";
import { getActor, isResponse, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor(request);
  if (isResponse(actor)) return actor;
  const { id: commentId } = await context.params;
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, include: { report: { select: { reporterId: true, tasks: { select: { assignedStaffId: true } } } } } });
  if (!comment) return jsonError("Comment not found.", 404);
  const canAccess = actor.role === Role.ADMIN || comment.authorId === actor.id || (actor.role === Role.USER && comment.report.reporterId === actor.id) || (actor.role === Role.STAFF && comment.report.tasks.some((task) => task.assignedStaffId === actor.id));
  if (!canAccess) return jsonError("You do not have access to this comment.", 403);
  const formData = await request.formData();
  const result = validateAttachmentFiles(formData.getAll("files"));
  if (!("files" in result)) return jsonError(result.error);
  const attachments = await createAttachments({ reportId: comment.reportId, commentId, taskId: comment.taskId ?? undefined, uploadedById: actor.id, files: result.files });
  return NextResponse.json({ data: attachments }, { status: 201 });
}
