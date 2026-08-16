import { NextResponse } from "next/server";
import { handleCallWebhook } from "@/lib/dialer/engine";
import type { BlandWebhookPayload } from "@/lib/telephony/bland";

// Called by the telephony backend when a campaign call finishes. Not
// user-auth-scoped (Bland has no way to carry our session cookie) -- the
// lookup is scoped by call_id/metadata.leadId instead, so a payload for an
// unrecognized call is just logged and ignored, not trusted blindly.
export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as BlandWebhookPayload | null;
  if (!payload?.call_id) {
    return NextResponse.json({ error: "Missing call_id" }, { status: 400 });
  }
  await handleCallWebhook(payload);
  return NextResponse.json({ status: "ok" });
}
