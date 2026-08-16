import { NextResponse } from "next/server";

const startedAt = new Date().toISOString();

export async function GET() {
  return NextResponse.json({
    sha: process.env.GIT_SHA || "unknown",
    built: startedAt,
  });
}
