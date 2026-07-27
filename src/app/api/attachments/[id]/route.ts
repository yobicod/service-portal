import { NextRequest } from "next/server";
import { Role } from "@/generated/prisma/client";
import { getActor, isResponse, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { downloadAttachment } from "@/lib/storage";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor(request);
  if (isResponse(actor)) return actor;
  const { id } = await context.params;
  const attachment = await prisma.attachment.findUnique({ where: { id }, include: { report: { select: { reporterId: true } }, task: { select: { assignedStaffId: true } }, comment: { include: { report: { select: { reporterId: true } }, task: { select: { assignedStaffId: true } } } } } });
  if (!attachment) return jsonError("Attachment not found.", 404);
  const ownsReport = attachment.report?.reporterId === actor.id || attachment.comment?.report.reporterId === actor.id;
  const ownsTask = attachment.task?.assignedStaffId === actor.id || attachment.comment?.task?.assignedStaffId === actor.id;
  if (actor.role === Role.USER && !ownsReport) return jsonError("You do not have access to this attachment.", 403);
  if (actor.role === Role.STAFF && !ownsTask && !ownsReport) return jsonError("You do not have access to this attachment.", 403);
  const object = await downloadAttachment(attachment.fileUrl);
  if (!object.Body) return jsonError("Attachment content is unavailable.", 404);
  return new Response(object.Body.transformToWebStream(), { headers: { "Content-Type": attachment.mimeType, "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`, "Cache-Control": "private, max-age=3600" } });
}
