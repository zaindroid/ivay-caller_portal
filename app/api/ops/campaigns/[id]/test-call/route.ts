import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOps, guarded } from "@/lib/guards";
import { placeCall } from "@/lib/telephony/bland";
import { callParamsFromBotConfig, personalizationRequestData, webhookUrl } from "@/lib/dialer/engine";
import { addLog } from "@/lib/dialer/logs";
import { scrapeProfileText } from "@/lib/scrape";

/**
 * Places a single ad-hoc call to any number using this campaign's voice
 * agent, without touching the Lead table or campaign stats — purely for an
 * ops person to hear how the agent actually sounds on a real line.
 *
 * Optionally accepts a contact name and background (typed directly, or
 * scraped from a profileUrl) so the same personalization the dialer engine
 * applies to real leads can be previewed here too, before it's ever used on
 * a real lead list.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    await requireOps();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const phone = body?.phone?.trim();
    if (!phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });

    const contactName = typeof body?.contactName === "string" ? body.contactName.trim() : "";
    let background = typeof body?.background === "string" ? body.background.trim() : "";
    const profileUrl = typeof body?.profileUrl === "string" ? body.profileUrl.trim() : "";
    if (profileUrl && !background) {
      try {
        background = await scrapeProfileText(profileUrl);
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 400 });
      }
    }

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
      requestData: personalizationRequestData(contactName, background),
      webhookUrl: webhookUrl(),
      metadata: { test: "true", campaignId: id },
    });
    addLog(
      "info",
      `Test call placed to ${phone}${contactName ? ` (asking for ${contactName})` : ""} using ${campaign.botConfig.name} (call ${callId}) — not added to leads`
    );
    return NextResponse.json({ callId, background: background || undefined });
  });
}
