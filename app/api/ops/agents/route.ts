import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOps, guarded } from "@/lib/guards";
import { writeAgentConfigs, reloadAsterisk } from "@/lib/dialer/agents";
import { getAgentStates } from "@/lib/dialer/engine";
import { addLog } from "@/lib/dialer/logs";

export async function GET() {
  return guarded(async () => {
    await requireOps();
    const agents = await prisma.agentExtension.findMany({ orderBy: { extension: "asc" } });
    const states = getAgentStates();
    return NextResponse.json({
      agents: agents.map((a) => ({ ...a, ...states[a.extension] })),
      sipServer: process.env.SIP_SERVER || null,
    });
  });
}

export async function POST(request: Request) {
  return guarded(async () => {
    await requireOps();
    const body = await request.json().catch(() => null);
    const extension = parseInt(body?.extension, 10);
    const name = body?.name?.trim();
    const password = body?.password;

    if (isNaN(extension) || extension < 1000 || extension > 9999 || !password) {
      return NextResponse.json(
        { error: "extension must be 1000-9999 and password is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.agentExtension.findUnique({ where: { extension } });
    if (existing) return NextResponse.json({ error: `Extension ${extension} already exists` }, { status: 409 });

    const agent = await prisma.agentExtension.create({
      data: { extension, name: name || `Agent ${extension}`, password },
    });

    try {
      await writeAgentConfigs();
      await reloadAsterisk();
    } catch (e) {
      await prisma.agentExtension.delete({ where: { id: agent.id } });
      return NextResponse.json({ error: `Failed to write SIP config: ${(e as Error).message}` }, { status: 500 });
    }

    addLog("info", `Agent added: ext ${extension} (${agent.name})`);
    return NextResponse.json({ agent }, { status: 201 });
  });
}
