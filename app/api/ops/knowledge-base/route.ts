import { NextResponse } from "next/server";
import { requireOps, guarded } from "@/lib/guards";
import { learnFromWebsite } from "@/lib/telephony/bland";

export async function POST(request: Request) {
  return guarded(async () => {
    await requireOps();
    const body = await request.json().catch(() => null);
    const name = body?.name?.trim();
    const urlsInput = body?.urls;
    const urls: string[] = Array.isArray(urlsInput)
      ? urlsInput.map((u: string) => u.trim()).filter(Boolean)
      : typeof urlsInput === "string"
        ? urlsInput.split(/\s+/).map((u: string) => u.trim()).filter(Boolean)
        : [];

    if (!name || urls.length === 0) {
      return NextResponse.json({ error: "name and at least one URL are required" }, { status: 400 });
    }

    const knowledgeBase = await learnFromWebsite(name, urls, body?.description?.trim() || undefined);
    return NextResponse.json({ knowledgeBase }, { status: 201 });
  });
}
