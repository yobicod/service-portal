import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { getActor, isResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const actor = await getActor(request, [Role.ADMIN]);
  if (isResponse(actor)) return actor;
  const staff = await prisma.user.findMany({ where: { role: Role.STAFF }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ data: staff });
}
