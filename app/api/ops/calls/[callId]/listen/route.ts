import { NextResponse } from "next/server";
import { requireOps, guarded } from "@/lib/guards";
import { getCallListenUrl } from "@/lib/telephony/bland";
import { addLog } from "@/lib/dialer/logs";

/**
 * Hands the ops browser a WebSocket URL for silently listening in on a live
 * call. The URL carries its own per-call token, so the browser connects to
 * it directly -- our telephony API key never leaves the server.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ callId: string }> }) {
  return guarded(async () => {
    const session = await requireOps();
    const { callId } = await params;
    if (!callId) return NextResponse.json({ error: "callId is required" }, { status: 400 });

    try {
      const url = await getCallListenUrl(callId);
      addLog("info", `Ops user ${session.userId} started shadow-listening call ${callId}`);
      return NextResponse.json({ url });
    } catch (e) {
      // 409, not 5xx: the call itself is fine — this is a config/state problem
      // (live-listen disabled, call already ended). A 5xx here also gets its
      // body swapped for a generic proxy error page, hiding the reason.
      return NextResponse.json({ error: (e as Error).message }, { status: 409 });
    }
  });
}
