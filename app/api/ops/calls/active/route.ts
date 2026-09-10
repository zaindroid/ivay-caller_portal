import { NextResponse } from "next/server";
import { requireOps, guarded } from "@/lib/guards";
import { listActiveCalls } from "@/lib/telephony/bland";
import { getTrackedCalls } from "@/lib/dialer/active-calls";

/**
 * Every call currently live on the telephony account, for the Live Calls
 * page. Calls this portal placed carry a campaign/agent label from the
 * in-process registry; anything else (e.g. an inbound call) still shows up
 * from the backend's own active-call list so it can be listened to too.
 */
export async function GET() {
  return guarded(async () => {
    await requireOps();

    const tracked = getTrackedCalls();
    const trackedById = new Map(tracked.map((c) => [c.callId, c]));

    let backend: Awaited<ReturnType<typeof listActiveCalls>> = [];
    let backendError: string | undefined;
    try {
      backend = await listActiveCalls();
    } catch (e) {
      backendError = (e as Error).message;
    }

    const merged = new Map<
      string,
      { callId: string; to: string; label: string; startedAt: string | null; status: string }
    >();

    for (const c of backend) {
      merged.set(c.callId, {
        callId: c.callId,
        to: c.to,
        label: trackedById.get(c.callId)?.label ?? (c.to ? `Call to ${c.to}` : "Live call"),
        startedAt: c.startedAt,
        status: c.status || "in progress",
      });
    }
    for (const c of tracked) {
      if (!merged.has(c.callId)) {
        merged.set(c.callId, { callId: c.callId, to: c.to, label: c.label, startedAt: c.startedAt, status: "in progress" });
      }
    }

    const calls = [...merged.values()].sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
    return NextResponse.json({ calls, backendError });
  });
}
