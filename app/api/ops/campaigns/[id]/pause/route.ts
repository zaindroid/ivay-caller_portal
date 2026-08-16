import { NextResponse } from "next/server";
import { requireOps, guarded } from "@/lib/guards";
import { pauseCampaign } from "@/lib/dialer/engine";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    await requireOps();
    const { id } = await params;
    await pauseCampaign(id);
    return NextResponse.json({ status: "paused" });
  });
}
