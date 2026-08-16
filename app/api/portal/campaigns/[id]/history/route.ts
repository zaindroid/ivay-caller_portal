import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guarded, requireOwnedCampaign } from "@/lib/guards";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    const { id } = await params;
    await requireOwnedCampaign(id);
    const calls = await prisma.callHistory.findMany({
      where: { campaignId: id },
      orderBy: { endedAt: "desc" },
      take: 200,
      include: { lead: { select: { name: true, phone: true } } },
    });
    return NextResponse.json({ calls });
  });
}
