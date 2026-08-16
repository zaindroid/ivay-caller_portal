import { NextResponse } from "next/server";
import { guarded, requireOwnedCampaign } from "@/lib/guards";
import { campaignStatus } from "@/lib/dialer/engine";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    const { id } = await params;
    const campaign = await requireOwnedCampaign(id);
    const status = await campaignStatus(id);
    return NextResponse.json({ campaign: { id: campaign.id, name: campaign.name }, status });
  });
}
