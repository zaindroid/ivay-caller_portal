import { NextResponse } from "next/server";
import { requireOps, guarded } from "@/lib/guards";
import { listVoices } from "@/lib/telephony/bland";

// Curated so the picker stays usable -- the underlying catalog has ~1000
// entries, most irrelevant (other languages, one-off clones, etc).
const RELEVANT_TAGS = ["english", "german", "french", "spanish", "bland curated"];

export async function GET() {
  return guarded(async () => {
    await requireOps();
    const voices = await listVoices();
    const curated = voices.filter((v) => v.tags.some((t) => RELEVANT_TAGS.includes(t.toLowerCase())));
    return NextResponse.json({ voices: curated });
  });
}
