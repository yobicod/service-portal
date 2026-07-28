export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export type AttachmentSelectionError = "type" | "size";

export function attachmentSelectionError(file: {
  type: string;
  size: number;
}): AttachmentSelectionError | null {
  if (!ATTACHMENT_TYPES.has(file.type)) return "type";
  if (file.size > ATTACHMENT_MAX_BYTES) return "size";
  return null;
}
