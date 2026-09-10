import { NextResponse } from "next/server";
import { requireOps, guarded } from "@/lib/guards";
import { getCallRecording } from "@/lib/telephony/bland";

/**
 * Streams a finished call's recording through to the browser. The audio
 * lives on the telephony backend, not in our database -- this just proxies
 * it, authenticated with our API key server-side, so the key never reaches
 * the client. An <audio> tag can point straight at this URL.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ callId: string }> }) {
  return guarded(async () => {
    await requireOps();
    const { callId } = await params;
    if (!callId) return NextResponse.json({ error: "callId is required" }, { status: 400 });

    try {
      const { body, contentType } = await getCallRecording(callId);
      if (!body) return NextResponse.json({ error: "Recording had no audio data" }, { status: 502 });
      return new Response(body, { headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" } });
    } catch (e) {
      // 404, not 5xx: "no recording yet" is a normal, expected state (call
      // still in progress, or wasn't recorded) -- not a server fault, and a
      // 5xx body gets swapped for a generic proxy error page.
      return NextResponse.json({ error: (e as Error).message }, { status: 404 });
    }
  });
}
