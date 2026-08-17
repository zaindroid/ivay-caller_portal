import { NextResponse } from "next/server";
import { requireOps, guarded } from "@/lib/guards";
import { previewVoice } from "@/lib/telephony/bland";

export async function POST(request: Request) {
  return guarded(async () => {
    await requireOps();
    const body = await request.json().catch(() => null);
    const voiceId = body?.voiceId as string | undefined;
    const text = (body?.text as string | undefined) || "Hi, this is a preview of this voice.";
    if (!voiceId) return NextResponse.json({ error: "voiceId is required" }, { status: 400 });

    const wav = await previewVoice(voiceId, text);
    return new Response(new Uint8Array(wav), { headers: { "Content-Type": "audio/wav" } });
  });
}
