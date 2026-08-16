import { prisma } from "@/lib/db";
import { ami, isAmiConnected } from "./ami";
import { addLog } from "./logs";
import type { LeadStatus } from "@/app/generated/prisma/client";

/**
 * Multi-campaign outbound dialing engine — ported from the caller_agent
 * prototype's dialer/index.js. The prototype tracked one global campaign
 * against module-level objects (leads[], activeCalls{}, etc); this version
 * keys everything by campaignId and persists lead/call state to Postgres
 * instead of losing it on restart. The AMI event-handling shape (Newchannel,
 * Hangup, OriginateResponse, Bridge/BridgeEnter, DeviceStateChange) and the
 * throttled dialNext() loop are unchanged in spirit.
 *
 * NOTE: this assumes an Asterisk dialplan exists (on the VPS, not in this
 * repo — same as the prototype) with a `from-dialer` context whose answering
 * extension bridges to whatever bot provider the campaign's BotConfig names.
 * That extension is expected to POST to /api/bot/callback to report
 * connect/transfer/hangup events back here where AMI events don't cover it.
 */

// uniqueid -> { campaignId, leadId }
const activeCalls = new Map<string, { campaignId: string; leadId: string }>();
// uniqueid -> asterisk channel name
const activeChannels = new Map<string, string>();
// extension -> { state, channel?, since }
const agentStates = new Map<number, { state: string; channel?: string; since: string }>();

function activeCallCountFor(campaignId: string) {
  let n = 0;
  for (const v of activeCalls.values()) if (v.campaignId === campaignId) n++;
  return n;
}

export function getAgentStates() {
  return Object.fromEntries(agentStates);
}

async function isAgentExtension(ext: number) {
  const row = await prisma.agentExtension.findUnique({ where: { extension: ext } });
  return !!row;
}

async function markLead(leadId: string, status: LeadStatus, note?: string) {
  await prisma.lead.update({ where: { id: leadId }, data: { status, note } });
}

async function recordCallHistory(campaignId: string, leadId: string, outcome: LeadStatus, note?: string) {
  await prisma.callHistory.create({
    data: { campaignId, leadId, outcome, note },
  });
}

/** Originates the next batch of pending leads for a campaign, up to its maxConcurrent. */
export async function dialNext(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { phoneNumber: true },
  });
  if (!campaign || campaign.status !== "ACTIVE") return;
  if (!campaign.phoneNumber) {
    addLog("error", `Campaign ${campaignId} has no phone number assigned — cannot dial`);
    return;
  }

  while (activeCallCountFor(campaignId) < campaign.maxConcurrent) {
    const lead = await prisma.lead.findFirst({
      where: { campaignId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });

    if (!lead) {
      if (activeCallCountFor(campaignId) === 0) {
        await prisma.campaign.update({ where: { id: campaignId }, data: { status: "COMPLETED" } });
        addLog("info", `Campaign ${campaignId} complete`);
      }
      return;
    }

    await markLead(lead.id, "DIALING");
    addLog("info", `Dialing ${lead.name} at ${lead.phone} (campaign ${campaignId})`);

    const actionId = `lead-${lead.id}`;
    ami.action(
      {
        action: "Originate",
        channel: `PJSIP/${lead.phone}@${campaign.phoneNumber.trunkName}`,
        context: "from-dialer",
        exten: process.env.DIALER_ANSWER_EXTENSION || "ivay-bot",
        priority: 1,
        callerid: campaign.phoneNumber.number,
        timeout: 30000,
        actionid: actionId,
        variable: `LEAD_ID=${lead.id},CAMPAIGN_ID=${campaignId}`,
        async: "true",
      },
      async (err: Error | null) => {
        if (err) {
          await markLead(lead.id, "FAILED", err.message || "AMI error");
          addLog("error", `AMI error for lead ${lead.id}: ${err.message}`);
          void dialNext(campaignId);
        }
      }
    );
  }
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
let wired = false;
export function wireAmiEvents() {
  if (wired) return;
  wired = true;

  ami.on("managerevent", async (evt: Record<string, string>) => {
    try {
      if (evt.event === "Newchannel" && evt.uniqueid) {
        activeChannels.set(evt.uniqueid, evt.channel);
      }

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

      if (evt.event === "Hangup" && activeCalls.has(evt.uniqueid)) {
        const { campaignId, leadId } = activeCalls.get(evt.uniqueid)!;
        activeCalls.delete(evt.uniqueid);
        activeChannels.delete(evt.uniqueid);

        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (lead) {
          if (lead.status === "DIALING") {
            const note = `Cause: ${evt["cause-txt"] || evt.cause || "unknown"}`;
            await markLead(leadId, "FAILED", note);
            await recordCallHistory(campaignId, leadId, "FAILED", note);
            addLog("warn", `Call failed for ${lead.phone}: ${note}`);
          } else if (lead.status === "CONNECTED") {
            await markLead(leadId, "COMPLETED");
            await recordCallHistory(campaignId, leadId, "COMPLETED");
            addLog("info", `Call completed for ${lead.phone}`);
          }
        }
        void dialNext(campaignId);
      }

      if (evt.event === "OriginateResponse") {
        const leadId = (evt.actionid || "").replace("lead-", "");
        if (!leadId) return;
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return;

        if (evt.response === "Failure" || evt.response === "Error") {
          const note = evt.reason || "Originate failed";
          await markLead(leadId, "FAILED", note);
          if (evt.uniqueid) activeCalls.delete(evt.uniqueid);
          addLog("error", `Originate failed for ${lead.phone}: ${note}`);
          void dialNext(lead.campaignId);
        } else if (evt.uniqueid) {
          activeCalls.set(evt.uniqueid, { campaignId: lead.campaignId, leadId });
          await markLead(leadId, "DIALING");
          addLog("info", `Dialing ${lead.phone} (lead ${leadId})`);
        }
      }

      if (evt.event === "Bridge" || evt.event === "BridgeEnter") {
        for (const uid of [evt.uniqueid, evt.uniqueid2]) {
          if (!uid || !activeCalls.has(uid)) continue;
          const { leadId } = activeCalls.get(uid)!;
          const lead = await prisma.lead.findUnique({ where: { id: leadId } });
          if (lead && lead.status === "DIALING") {
            await markLead(leadId, "CONNECTED");
            addLog("info", `${lead.phone} connected`);
          }
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
