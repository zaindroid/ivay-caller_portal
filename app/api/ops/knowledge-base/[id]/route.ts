import { NextResponse } from "next/server";
import { requireOps, guarded } from "@/lib/guards";
import { getKnowledgeBase } from "@/lib/telephony/bland";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    await requireOps();
    const { id } = await params;
    const knowledgeBase = await getKnowledgeBase(id);
    return NextResponse.json({ knowledgeBase });
  });
}
