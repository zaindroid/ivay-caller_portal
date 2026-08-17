import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOps, guarded } from "@/lib/guards";
import { placeCall } from "@/lib/telephony/bland";
import { callParamsFromBotConfig, webhookUrl } from "@/lib/dialer/engine";
import { addLog } from "@/lib/dialer/logs";

/**
 * Places a single ad-hoc call to any number using this campaign's voice
 * agent, without touching the Lead table or campaign stats — purely for an
 * ops person to hear how the agent actually sounds on a real line.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    await requireOps();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const phone = body?.phone?.trim();
    if (!phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { botConfig: true, phoneNumber: true },
    });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (!campaign.botConfig) return NextResponse.json({ error: "This campaign has no voice agent assigned" }, { status: 400 });

    const callParams = callParamsFromBotConfig((campaign.botConfig.config as Record<string, unknown>) || {});
    const { callId } = await placeCall({
      to: phone,
      from: campaign.phoneNumber?.number,
      ...callParams,
      webhookUrl: webhookUrl(),
      metadata: { test: "true", campaignId: id },
    });
    addLog("info", `Test call placed to ${phone} using ${campaign.botConfig.name} (call ${callId}) — not added to leads`);
    return NextResponse.json({ callId });
  });
}
