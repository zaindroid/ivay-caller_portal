import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOps, guarded } from "@/lib/guards";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    await requireOps();
    const { id } = await params;
    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        campaigns: { orderBy: { createdAt: "desc" }, include: { phoneNumber: true, botConfig: true } },
        phoneNumbers: true,
        users: { select: { id: true, email: true, role: true, createdAt: true } },
      },
    });
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    return NextResponse.json({ account });
  });
}
