import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOps, guarded } from "@/lib/guards";
import { campaignStatus } from "@/lib/dialer/engine";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    await requireOps();
    const { id } = await params;
    const [campaign, status] = await Promise.all([
      prisma.campaign.findUnique({
        where: { id },
        include: { phoneNumber: true, botConfig: true, account: true },
      }),
      campaignStatus(id),
    ]);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    return NextResponse.json({ campaign, status });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    await requireOps();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.maxConcurrent !== undefined) data.maxConcurrent = parseInt(body.maxConcurrent, 10);
    if (body.phoneNumberId !== undefined) data.phoneNumberId = body.phoneNumberId || null;
    if (body.botConfigId !== undefined) data.botConfigId = body.botConfigId || null;

    const campaign = await prisma.campaign.update({ where: { id }, data });
    return NextResponse.json({ campaign });
  });
}
