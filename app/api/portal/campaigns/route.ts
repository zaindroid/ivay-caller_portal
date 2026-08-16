import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient, guarded } from "@/lib/guards";

export async function GET() {
  return guarded(async () => {
    const { accountId } = await requireClient();
    const campaigns = await prisma.campaign.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true, createdAt: true },
    });
    return NextResponse.json({ campaigns });
  });
}
