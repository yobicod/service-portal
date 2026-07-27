import { ReportStatus, TaskStatus } from "@/generated/prisma/client";

export type StaffAction = "start" | "progress" | "complete";
export type AdminVerificationAction = "close" | "revision";

export function canReviewReport(status: ReportStatus) {
  return status === ReportStatus.SUBMITTED || status === ReportStatus.UNDER_REVIEW;
}

export function canAssignReport(status: ReportStatus) {
  return status === ReportStatus.APPROVED;
}

export function nextTaskStatusForStaffAction(status: TaskStatus, action: StaffAction): TaskStatus | null {
  if (action === "start" && (status === TaskStatus.ASSIGNED || status === TaskStatus.NEEDS_REVISION)) return TaskStatus.IN_PROGRESS;
  if (action === "progress" && status === TaskStatus.IN_PROGRESS) return TaskStatus.IN_PROGRESS;
  if (action === "complete" && status === TaskStatus.IN_PROGRESS) return TaskStatus.COMPLETED_BY_STAFF;
  return null;
}

export function nextReportStatusForStaffAction(action: StaffAction) {
  return action === "complete" ? ReportStatus.COMPLETED_BY_STAFF : ReportStatus.IN_PROGRESS;
}

export function canVerifyTask(status: TaskStatus) {
  return status === TaskStatus.COMPLETED_BY_STAFF;
}

export function nextTaskStatusForVerification(action: AdminVerificationAction) {
  return action === "close" ? TaskStatus.CLOSED : TaskStatus.NEEDS_REVISION;
}

export function nextReportStatusForVerification(action: AdminVerificationAction) {
  return action === "close" ? ReportStatus.CLOSED : ReportStatus.NEEDS_REVISION;
}
