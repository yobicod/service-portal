import { NextRequest, NextResponse } from "next/server";
import { ReportStatus, Role } from "@/generated/prisma/client";
import { createReferenceNo, getActor, isResponse, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  createReportWithStatusLog,
  parseReportSubmission,
  ReportSubmissionValidationError,
} from "@/lib/report-submission";

export async function GET(request: NextRequest) {
  const actor = await getActor(request);
  if (isResponse(actor)) return actor;

  const pageValue = Number(request.nextUrl.searchParams.get("page"));
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const pageSizeValue = Number(request.nextUrl.searchParams.get("pageSize"));
  const pageSize = Math.min(
    Number.isSafeInteger(pageSizeValue) && pageSizeValue > 0
      ? pageSizeValue
      : 10,
    50,
  );
  const requestedStatus = request.nextUrl.searchParams.get("status");
  const status =
    requestedStatus &&
    Object.values(ReportStatus).includes(requestedStatus as ReportStatus)
      ? (requestedStatus as ReportStatus)
      : undefined;
  const where = { reporterId: actor.id, ...(status ? { status } : {}) };
  const total = await prisma.maintenanceReport.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const resolvedPage = Math.min(page, totalPages);
  const reports = await prisma.maintenanceReport.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: (resolvedPage - 1) * pageSize,
    take: pageSize,
  });
  return NextResponse.json({
    data: reports,
    pagination: { page: resolvedPage, pageSize, total, totalPages },
  });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getActor(request, [Role.USER]);
    if (isResponse(actor)) return actor;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Request body must be valid JSON.");
    }
    const submission = parseReportSubmission(body);
    const report = await prisma.$transaction((tx) =>
      createReportWithStatusLog(tx, actor.id, createReferenceNo(), submission),
    );

    return NextResponse.json({ data: report }, { status: 201 });
  } catch (error) {
    if (error instanceof ReportSubmissionValidationError) {
      return jsonError(error.message);
    }
    console.error("Unable to create maintenance report.", error);
    return jsonError("Unable to create the request. Please try again.", 500);
  }
}
