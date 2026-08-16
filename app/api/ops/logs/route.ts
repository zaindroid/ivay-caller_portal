import { NextResponse } from "next/server";
import { requireOps, guarded } from "@/lib/guards";
import { getLogs, type LogLevel } from "@/lib/dialer/logs";

export async function GET(request: Request) {
  return guarded(async () => {
    await requireOps();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const level = (searchParams.get("level") as LogLevel | null) || undefined;
    return NextResponse.json({ logs: getLogs(limit, level) });
  });
}
