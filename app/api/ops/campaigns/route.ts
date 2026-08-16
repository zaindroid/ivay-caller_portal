import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOps, guarded } from "@/lib/guards";

export async function POST(request: Request) {
  return guarded(async () => {
    await requireOps();
    const body = await request.json().catch(() => null);
    const accountId = body?.accountId;
    const name = body?.name?.trim();
    const maxConcurrent = parseInt(body?.maxConcurrent ?? "3", 10);
    const phoneNumberId = body?.phoneNumberId || null;
    const botConfigId = body?.botConfigId || null;

    if (!accountId || !name) {
      return NextResponse.json({ error: "accountId and name are required" }, { status: 400 });
    }

    const campaign = await prisma.campaign.create({
      data: { accountId, name, maxConcurrent, phoneNumberId, botConfigId },
    });
    return NextResponse.json({ campaign }, { status: 201 });
  });
}
