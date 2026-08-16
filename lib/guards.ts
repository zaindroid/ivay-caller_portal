import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/db";

export class GuardError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireOps(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== "OPS") throw new GuardError(401, "Ops authentication required");
  return session;
}

/** Returns the session plus the resolved accountId scope for a client user. */
export async function requireClient(): Promise<SessionPayload & { accountId: string }> {
  const session = await getSession();
  if (!session || session.role !== "CLIENT" || !session.accountId) {
    throw new GuardError(401, "Client authentication required");
  }
  return { ...session, accountId: session.accountId };
}

/** Verifies the current client session owns the given campaign; throws 404 otherwise. */
export async function requireOwnedCampaign(campaignId: string) {
  const { accountId } = await requireClient();
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, accountId } });
  if (!campaign) throw new GuardError(404, "Campaign not found");
  return campaign;
}

export function guarded(handler: () => Promise<Response>): Promise<Response> {
  return handler().catch((e) => {
    if (e instanceof GuardError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  });
}
