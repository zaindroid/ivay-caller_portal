import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOps, guarded } from "@/lib/guards";

export async function GET() {
  return guarded(async () => {
    await requireOps();
    const botConfigs = await prisma.botConfig.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ botConfigs });
  });
}

export async function POST(request: Request) {
  return guarded(async () => {
    await requireOps();
    const body = await request.json().catch(() => null);
    const name = body?.name?.trim();
    const provider = body?.provider;
    const config = body?.config ?? {};

    if (!name || !provider) {
      return NextResponse.json({ error: "name and provider are required" }, { status: 400 });
    }

    const botConfig = await prisma.botConfig.create({ data: { name, provider, config } });
    return NextResponse.json({ botConfig }, { status: 201 });
  });
}
