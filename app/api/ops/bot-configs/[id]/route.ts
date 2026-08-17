import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOps, guarded } from "@/lib/guards";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    await requireOps();
    const { id } = await params;
    const botConfig = await prisma.botConfig.findUnique({ where: { id } });
    if (!botConfig) return NextResponse.json({ error: "Voice agent not found" }, { status: 404 });
    return NextResponse.json({ botConfig });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    await requireOps();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const data: Record<string, unknown> = {};
    if (body?.name !== undefined) data.name = body.name.trim();
    if (body?.config !== undefined) data.config = body.config;

    const botConfig = await prisma.botConfig.update({ where: { id }, data });
    return NextResponse.json({ botConfig });
  });
}
