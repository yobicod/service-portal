import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { getActor, isResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const actor = await getActor(request, [Role.STAFF]);
  if (isResponse(actor)) return actor;
  const tasks = await prisma.maintenanceTask.findMany({ where: { assignedStaffId: actor.id }, include: { report: true, attachments: true }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] });
  return NextResponse.json({ data: tasks });
}
