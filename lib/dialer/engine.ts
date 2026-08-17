import { prisma } from "@/lib/db";
import { ami, isAmiConnected } from "./ami";
import { addLog } from "./logs";
import { placeCall, type BlandWebhookPayload } from "@/lib/telephony/bland";

/**
 * Multi-campaign outbound dialing engine. Campaign calls are placed through
 * the voice-AI telephony backend (lib/telephony/bland.ts) — one API call per
 * lead, no PBX/SIP layer of our own involved in the campaign call path.
 * Concurrency is tracked by counting DIALING leads in Postgres rather than
 * in-memory state, since there's no persistent per-call channel/session to
 * hold onto the way there was with an AMI-originated call.
 *
 * The Asterisk/AMI connection (ami.ts) is kept for a separate, narrower job:
 * human-agent SIP extension presence (lib/dialer/agents.ts), not campaign
 * dialing.
 */

// extension -> { state, channel?, since }
const agentStates = new Map<number, { state: string; channel?: string; since: string }>();

export function getAgentStates() {
  return Object.fromEntries(agentStates);
}

async function isAgentExtension(ext: number) {
  const row = await prisma.agentExtension.findUnique({ where: { extension: ext } });
  return !!row;
}

async function markLead(leadId: string, status: "COMPLETED" | "FAILED", note?: string) {
  await prisma.lead.update({ where: { id: leadId }, data: { status, note } });
}

async function recordCallHistory(campaignId: string, leadId: string, outcome: "COMPLETED" | "FAILED", note?: string) {
  await prisma.callHistory.create({ data: { campaignId, leadId, outcome, note } });
}

function webhookUrl() {
  const base = process.env.APP_URL || (process.env.COOLIFY_FQDN ? `https://${process.env.COOLIFY_FQDN}` : "http://localhost:3000");
  return `${base}/api/bland/webhook`;
}

/** Places calls for a campaign's next pending leads, up to its maxConcurrent. */
export async function dialNext(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { phoneNumber: true, botConfig: true },
  });
  if (!campaign || campaign.status !== "ACTIVE") return;
  if (!campaign.botConfig) {
    addLog("error", `Campaign ${campaignId} has no voice agent assigned — cannot dial`);
    return;
  }

  const config = (campaign.botConfig.config as Record<string, unknown>) || {};
  const task = (config.task as string) || (config.greeting as string) || "You are calling on behalf of Ivay. Introduce yourself briefly and ask how you can help.";
  const voice = config.voice as string | undefined;
  const language = config.language as string | undefined;
  const firstSentence = config.firstSentence as string | undefined;

  let activeCount = await prisma.lead.count({ where: { campaignId, status: "DIALING" } });

  while (activeCount < campaign.maxConcurrent) {
    const lead = await prisma.lead.findFirst({
      where: { campaignId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
    if (!lead) break;

    try {
      const { callId } = await placeCall({
        to: lead.phone,
        from: campaign.phoneNumber?.number,
        task,
        voice,
        language,
        firstSentence,
        webhookUrl: webhookUrl(),
        metadata: { leadId: lead.id, campaignId },
      });
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "DIALING", externalCallId: callId } });
      addLog("info", `Dialing ${lead.name} at ${lead.phone} (call ${callId})`);
      activeCount++; // only a real in-flight call consumes a concurrency slot
    } catch (e) {
      await markLead(lead.id, "FAILED", (e as Error).message);
      await recordCallHistory(campaignId, lead.id, "FAILED", (e as Error).message);
      addLog("error", `Call failed for ${lead.phone}: ${(e as Error).message}`);
    }
  }

  const remaining = await prisma.lead.count({ where: { campaignId, status: { in: ["PENDING", "DIALING"] } } });
  if (remaining === 0) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "COMPLETED" } });
    addLog("info", `Campaign ${campaignId} complete`);
  }
}

/** Called by /api/bland/webhook when a call finishes. */
export async function handleCallWebhook(payload: BlandWebhookPayload) {
  const leadId = payload.metadata?.leadId;
  const lead = leadId
    ? await prisma.lead.findUnique({ where: { id: leadId } })
    : await prisma.lead.findFirst({ where: { externalCallId: payload.call_id } });
  if (!lead) {
    addLog("warn", `Bland webhook for unknown call ${payload.call_id}`);
    return;
  }
  if (lead.status !== "DIALING") return; // already handled (duplicate webhook delivery)

  const failed = Boolean(payload.status && /fail|no.?answer|busy|error/i.test(payload.status));
  const outcome = failed ? "FAILED" : "COMPLETED";
  const note = failed ? payload.status : undefined;

  await markLead(lead.id, outcome, note);
  await recordCallHistory(lead.campaignId, lead.id, outcome, note);
  addLog("info", `Call ${outcome === "COMPLETED" ? "completed" : "failed"} for ${lead.phone}`);

  void dialNext(lead.campaignId);
}

export async function startCampaign(campaignId: string) {
  // Recover any leads stuck mid-dial from a previous crash/restart.
  await prisma.lead.updateMany({
    where: { campaignId, status: "DIALING" },
    data: { status: "PENDING" },
  });
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "ACTIVE" } });
  addLog("info", `Campaign ${campaignId} started`);
  void dialNext(campaignId);
}

export async function pauseCampaign(campaignId: string) {
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "PAUSED" } });
  addLog("info", `Campaign ${campaignId} paused`);
}

export async function campaignStatus(campaignId: string) {
  const [campaign, counts] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId } }),
    prisma.lead.groupBy({ by: ["status"], where: { campaignId }, _count: true }),
  ]);
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of counts) {
    byStatus[row.status] = row._count;
    total += row._count;
  }
  return {
    campaign: campaign ? { status: campaign.status, maxConcurrent: campaign.maxConcurrent } : null,
    counts: { total, ...byStatus },
    ami: isAmiConnected() ? "connected" : "disconnected",
  };
}

// ── AMI event wiring (module-level, runs once per process) ──────────────────
// Now scoped to human-agent extension presence only -- campaign dialing no
// longer goes through AMI. Kept so the Agents page still shows live status.
let wired = false;
export function wireAmiEvents() {
  if (wired) return;
  wired = true;

  ami.on("managerevent", async (evt: Record<string, string>) => {
    try {
      if (evt.event === "DeviceStateChange" || evt.event === "ExtensionStatus") {
        const extStr = (evt.device || evt.exten || "").replace("PJSIP/", "");
        const ext = parseInt(extStr, 10);
        if (!isNaN(ext) && (await isAgentExtension(ext))) {
          agentStates.set(ext, { state: evt.state || evt.statustext || "unknown", since: new Date().toISOString() });
        }
      }

      if (evt.event === "BridgeEnter" && evt.channel) {
        const m = evt.channel.match(/PJSIP\/(\d{4})-/);
        if (m && (await isAgentExtension(parseInt(m[1], 10)))) {
          agentStates.set(parseInt(m[1], 10), { state: "In use", channel: evt.channel, since: new Date().toISOString() });
        }
      }
      if (evt.event === "BridgeLeave" && evt.channel) {
        const m = evt.channel.match(/PJSIP\/(\d{4})-/);
        if (m && (await isAgentExtension(parseInt(m[1], 10)))) {
          agentStates.set(parseInt(m[1], 10), { state: "Not in use", since: new Date().toISOString() });
        }
      }
    } catch (e) {
      addLog("error", `AMI event handler error: ${(e as Error).message}`);
    }
  });

  ami.on("connect", () => addLog("info", "AMI connected to Asterisk"));
  ami.on("disconnect", () => addLog("warn", "AMI disconnected from Asterisk"));
  ami.on("error", (e: Error) => addLog("error", `AMI error: ${e.message}`));
}
