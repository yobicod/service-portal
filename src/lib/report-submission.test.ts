import assert from "node:assert/strict";
import test from "node:test";
import { Priority } from "@/generated/prisma/client";
import {
  createReportWithStatusLog,
  parseReportSubmission,
  ReportSubmissionValidationError,
} from "./report-submission";

const validPayload = {
  title: "  Broken light  ",
  description: "  The lamp does not turn on.  ",
  category: "  Electrical  ",
  location: "  Hallway  ",
};

test("parses a valid submission with default priority and no coordinates", () => {
  assert.deepEqual(parseReportSubmission(validPayload), {
    title: "Broken light",
    description: "The lamp does not turn on.",
    category: "Electrical",
    location: "Hallway",
    latitude: null,
    longitude: null,
    priority: Priority.MEDIUM,
  });
});

test("accepts valid map coordinates", () => {
  const submission = parseReportSubmission({
    ...validPayload,
    latitude: 13.7563,
    longitude: 100.5018,
    priority: Priority.HIGH,
  });

  assert.equal(submission.latitude, "13.7563");
  assert.equal(submission.longitude, "100.5018");
  assert.equal(submission.priority, Priority.HIGH);
});

test("rejects malformed and invalid submissions with a controlled validation error", () => {
  for (const payload of [
    null,
    { ...validPayload, priority: "URGENT" },
    { ...validPayload, latitude: 91, longitude: 100 },
    { ...validPayload, latitude: 13 },
  ]) {
    assert.throws(
      () => parseReportSubmission(payload),
      ReportSubmissionValidationError,
    );
  }
});

test("persists a report and its submitted status log together", async () => {
  const reportCreateCalls: unknown[] = [];
  const statusLogCreateCalls: unknown[] = [];
  const transaction = {
    maintenanceReport: {
      create: async (args: unknown) => {
        reportCreateCalls.push(args);
        return { id: "report-1" };
      },
    },
    statusLog: {
      create: async (args: unknown) => {
        statusLogCreateCalls.push(args);
        return { id: "log-1" };
      },
    },
  };

  const report = await createReportWithStatusLog(
    transaction as never,
    "user-1",
    "MR-20260727-ABC123",
    parseReportSubmission(validPayload),
  );

  assert.deepEqual(report, { id: "report-1" });
  assert.deepEqual(reportCreateCalls, [
    {
      data: {
        referenceNo: "MR-20260727-ABC123",
        reporterId: "user-1",
        title: "Broken light",
        description: "The lamp does not turn on.",
        category: "Electrical",
        location: "Hallway",
        priority: Priority.MEDIUM,
        status: "SUBMITTED",
      },
    },
  ]);
  assert.deepEqual(statusLogCreateCalls, [
    {
      data: {
        reportId: "report-1",
        changedById: "user-1",
        toStatus: "SUBMITTED",
        comment: "Maintenance request submitted.",
      },
    },
  ]);
});
