import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { auth } from "@/auth";

export type RequestActor = { id: string; role: Role };

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function getActor(_request: NextRequest, allowedRoles?: Role[]): Promise<RequestActor | NextResponse> {
  const session = await auth();
  const id = session?.user?.id;
  const role = session?.user?.role;
  if (!id || !role) return jsonError("Authentication is required.", 401);
  if (allowedRoles && !allowedRoles.includes(role)) return jsonError("You do not have permission for this action.", 403);
  return { id, role };
}

export function isResponse(value: RequestActor | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export function createReferenceNo() {
  const date = new Date();
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("");
  return `MR-${day}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}
