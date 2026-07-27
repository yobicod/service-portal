import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const defaultPageSize = 10;
const maxPageSize = 50;

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const page = parsePositiveInteger(
    request.nextUrl.searchParams.get("page"),
    1,
  );
  const pageSize = Math.min(
    parsePositiveInteger(
      request.nextUrl.searchParams.get("pageSize"),
      defaultPageSize,
    ),
    maxPageSize,
  );
  const total = await prisma.maintenanceReport.count();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const resolvedPage = Math.min(page, totalPages);
  const [reports, statusCounts] = await Promise.all([
    prisma.maintenanceReport.findMany({
      select: {
        id: true,
        referenceNo: true,
        title: true,
        category: true,
        location: true,
        priority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      skip: (resolvedPage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.maintenanceReport.groupBy({
      by: ["status"],
      orderBy: { status: "asc" },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json(
    {
      data: reports,
      pagination: {
        page: resolvedPage,
        pageSize,
        total,
        totalPages,
      },
      statusCounts: Object.fromEntries(
        statusCounts.map((item) => [
          item.status,
          typeof item._count === "object" ? (item._count._all ?? 0) : 0,
        ]),
      ),
    },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
