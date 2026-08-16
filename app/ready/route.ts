import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Dependency check -- confirms Postgres is actually reachable, unlike /health.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ready" });
  } catch {
    return NextResponse.json({ status: "not_ready" }, { status: 503 });
  }
}
