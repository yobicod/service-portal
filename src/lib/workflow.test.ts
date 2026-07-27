import assert from "node:assert/strict";
import test from "node:test";
import { ReportStatus, TaskStatus } from "@/generated/prisma/client";
import { canAssignReport, canReviewReport, canVerifyTask, nextReportStatusForStaffAction, nextReportStatusForVerification, nextTaskStatusForStaffAction, nextTaskStatusForVerification } from "./workflow";

test("only new reports can be reviewed and only approved reports can be assigned", () => {
  assert.equal(canReviewReport(ReportStatus.SUBMITTED), true);
  assert.equal(canReviewReport(ReportStatus.UNDER_REVIEW), true);
  assert.equal(canReviewReport(ReportStatus.APPROVED), false);
  assert.equal(canAssignReport(ReportStatus.APPROVED), true);
  assert.equal(canAssignReport(ReportStatus.SUBMITTED), false);
});

test("staff task transitions follow the repair lifecycle", () => {
  assert.equal(nextTaskStatusForStaffAction(TaskStatus.ASSIGNED, "start"), TaskStatus.IN_PROGRESS);
  assert.equal(nextTaskStatusForStaffAction(TaskStatus.NEEDS_REVISION, "start"), TaskStatus.IN_PROGRESS);
  assert.equal(nextTaskStatusForStaffAction(TaskStatus.IN_PROGRESS, "progress"), TaskStatus.IN_PROGRESS);
  assert.equal(nextTaskStatusForStaffAction(TaskStatus.IN_PROGRESS, "complete"), TaskStatus.COMPLETED_BY_STAFF);
  assert.equal(nextTaskStatusForStaffAction(TaskStatus.ASSIGNED, "complete"), null);
  assert.equal(nextTaskStatusForStaffAction(TaskStatus.COMPLETED_BY_STAFF, "progress"), null);
  assert.equal(nextReportStatusForStaffAction("complete"), ReportStatus.COMPLETED_BY_STAFF);
});

test("only completed work can be verified and verification has two outcomes", () => {
  assert.equal(canVerifyTask(TaskStatus.COMPLETED_BY_STAFF), true);
  assert.equal(canVerifyTask(TaskStatus.IN_PROGRESS), false);
  assert.equal(nextTaskStatusForVerification("close"), TaskStatus.CLOSED);
  assert.equal(nextTaskStatusForVerification("revision"), TaskStatus.NEEDS_REVISION);
  assert.equal(nextReportStatusForVerification("close"), ReportStatus.CLOSED);
  assert.equal(nextReportStatusForVerification("revision"), ReportStatus.NEEDS_REVISION);
});
