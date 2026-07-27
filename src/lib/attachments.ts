import { AttachmentTarget } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { uploadAttachment } from "@/lib/storage";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maxBytes = 10 * 1024 * 1024;
type AttachmentValidation = { files: File[] } | { error: string };

export function validateAttachmentFiles(values: FormDataEntryValue[]): AttachmentValidation {
  const files = values.filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length) return { error: "At least one file is required." };
  if (files.some((file) => !allowedTypes.has(file.type))) return { error: "Only JPG, PNG, WEBP, and PDF files are allowed." };
  if (files.some((file) => file.size > maxBytes)) return { error: "Each attachment must be 10MB or smaller." };
  return { files };
}

export async function createAttachments({ reportId, taskId, commentId, uploadedById, files }: {
  reportId: string;
  taskId?: string;
  commentId?: string;
  uploadedById: string;
  files: File[];
}) {
  const target = commentId ? AttachmentTarget.COMMENT : taskId ? AttachmentTarget.TASK : AttachmentTarget.REPORT;
  return Promise.all(files.map(async (file) => {
    const fileUrl = await uploadAttachment(reportId, file);
    return prisma.attachment.create({ data: { target, reportId: target === AttachmentTarget.REPORT ? reportId : null, taskId, commentId, uploadedById, fileUrl, fileName: file.name, mimeType: file.type } });
  }));
}
