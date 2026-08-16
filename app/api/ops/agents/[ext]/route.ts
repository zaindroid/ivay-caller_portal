import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOps, guarded } from "@/lib/guards";
import { writeAgentConfigs, reloadAsterisk } from "@/lib/dialer/agents";
import { addLog } from "@/lib/dialer/logs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ ext: string }> }) {
  return guarded(async () => {
    await requireOps();
    const extension = parseInt((await params).ext, 10);

    const agent = await prisma.agentExtension.findUnique({ where: { extension } });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    await prisma.agentExtension.delete({ where: { extension } });

    try {
      await writeAgentConfigs();
      await reloadAsterisk();
    } catch (e) {
      // best-effort — re-create the DB row so state stays consistent with SIP config
      await prisma.agentExtension.create({ data: agent });
      return NextResponse.json({ error: `Failed to write SIP config: ${(e as Error).message}` }, { status: 500 });
    }

    addLog("info", `Agent removed: ext ${extension} (${agent.name})`);
    return NextResponse.json({ status: "removed" });
  });
}
