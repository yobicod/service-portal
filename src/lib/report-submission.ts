import { Priority, ReportStatus, type Prisma } from "@/generated/prisma/client";

export type ReportSubmission = {
  title: string;
  description: string;
  category: string;
  location: string;
  latitude: string | null;
  longitude: string | null;
  priority: Priority;
};

export class ReportSubmissionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportSubmissionValidationError";
  }
}

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseReportSubmission(body: unknown): ReportSubmission {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ReportSubmissionValidationError("A JSON object is required.");
  }

  const { title, description, category, location, latitude, longitude } =
    body as Record<string, unknown>;
  const priority =
    (body as Record<string, unknown>).priority ?? Priority.MEDIUM;
  const normalized = {
    title: trimString(title),
    description: trimString(description),
    category: trimString(category),
    location: trimString(location),
  };
  if (!Object.values(normalized).every(Boolean)) {
    throw new ReportSubmissionValidationError(
      "title, description, category, and location are required.",
    );
  }
  if (
    typeof priority !== "string" ||
    !Object.values(Priority).includes(priority as Priority)
  ) {
    throw new ReportSubmissionValidationError("Invalid priority.");
  }

  const coordinatesProvided = latitude !== undefined || longitude !== undefined;
  const latitudeValue = Number(latitude);
  const longitudeValue = Number(longitude);
  if (
    coordinatesProvided &&
    (!Number.isFinite(latitudeValue) ||
      !Number.isFinite(longitudeValue) ||
      latitudeValue < -90 ||
      latitudeValue > 90 ||
      longitudeValue < -180 ||
      longitudeValue > 180)
  ) {
    throw new ReportSubmissionValidationError("Invalid map coordinates.");
  }

  return {
    ...normalized,
    latitude: coordinatesProvided ? String(latitudeValue) : null,
    longitude: coordinatesProvided ? String(longitudeValue) : null,
    priority: priority as Priority,
  };
}

type ReportCreationClient = Pick<
  Prisma.TransactionClient,
  "maintenanceReport" | "statusLog"
>;

export async function createReportWithStatusLog(
  tx: ReportCreationClient,
  actorId: string,
  referenceNo: string,
  submission: ReportSubmission,
) {
  const created = await tx.maintenanceReport.create({
    data: {
      referenceNo,
      reporterId: actorId,
      title: submission.title,
      description: submission.description,
      category: submission.category,
      location: submission.location,
      ...(submission.latitude !== null
        ? { latitude: submission.latitude, longitude: submission.longitude }
        : {}),
      priority: submission.priority,
      status: ReportStatus.SUBMITTED,
    },
  });
  await tx.statusLog.create({
    data: {
      reportId: created.id,
      changedById: actorId,
      toStatus: ReportStatus.SUBMITTED,
      comment: "Maintenance request submitted.",
    },
  });
  return created;
}
