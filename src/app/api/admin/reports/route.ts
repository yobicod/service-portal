import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { getActor, isResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const actor = await getActor(request, [Role.ADMIN]);
  if (isResponse(actor)) return actor;

  const reports = await prisma.maintenanceReport.findMany({
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      tasks: { include: { assignedStaff: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json({ data: reports });
}
