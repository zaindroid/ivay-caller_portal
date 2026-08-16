import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOps, guarded } from "@/lib/guards";
import { startCampaign } from "@/lib/dialer/engine";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    await requireOps();
    const { id } = await params;

    const [leadCount, campaign] = await Promise.all([
      prisma.lead.count({ where: { campaignId: id, status: "PENDING" } }),
      prisma.campaign.findUnique({ where: { id } }),
    ]);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (!campaign.phoneNumberId) {
      return NextResponse.json({ error: "Assign a phone number before starting" }, { status: 400 });
    }
    if (leadCount === 0) {
      return NextResponse.json({ error: "No pending leads to dial" }, { status: 400 });
    }

    await startCampaign(id);
    return NextResponse.json({ status: "started" });
  });
}
