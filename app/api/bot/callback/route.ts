import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ami } from "@/lib/dialer/ami";
import { addLog } from "@/lib/dialer/logs";

/**
 * Called by the Asterisk-side bot bridge (ivay's voice engine) to hand a
 * live call off to the human-agent queue. Replaces the prototype's
 * unauthenticated global POST /api/transfer — this is scoped per campaign
 * via a webhook secret (Campaign.webhookSecret) instead of being open, since
 * this app now serves multiple clients' campaigns at once.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-campaign-token");
  if (!secret) return NextResponse.json({ error: "Missing x-campaign-token" }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({ where: { webhookSecret: secret } });
  if (!campaign) return NextResponse.json({ error: "Invalid campaign token" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const phone = body?.phone as string | undefined;

  const lead = phone
    ? await prisma.lead.findFirst({ where: { campaignId: campaign.id, status: "CONNECTED", phone } })
    : await prisma.lead.findFirst({ where: { campaignId: campaign.id, status: "CONNECTED" } });

  if (!lead) return NextResponse.json({ error: "No connected call found" }, { status: 404 });

  // The channel name for this lead's call is tracked in-process by the
  // dialer engine's AMI event handlers, not persisted — the bot bridge is
  // expected to supply it directly since it's the one holding the channel.
  const channel = body?.channel as string | undefined;
  if (!channel) return NextResponse.json({ error: "channel is required" }, { status: 400 });

  addLog("info", `Transferring ${lead.phone} on ${channel} to agents queue (campaign ${campaign.id})`);

  return new Promise<Response>((resolve) => {
    ami.action(
      { action: "Redirect", channel, context: "from-internal", exten: "9000", priority: 1 },
      async (err: Error | null) => {
        if (err) {
          addLog("error", `Redirect failed: ${err.message}`);
          resolve(NextResponse.json({ error: err.message }, { status: 500 }));
          return;
        }
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "TRANSFERRED", note: "Transferred to agent" },
        });
        addLog("info", `Lead ${lead.phone} transferred to agents queue`);
        resolve(NextResponse.json({ status: "transferred", lead: lead.name, phone: lead.phone }));
      }
    );
  });
}
