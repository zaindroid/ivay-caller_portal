import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOps, guarded } from "@/lib/guards";

export async function GET() {
  return guarded(async () => {
    await requireOps();
    const numbers = await prisma.phoneNumber.findMany({
      orderBy: { createdAt: "desc" },
      include: { account: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ numbers });
  });
}

export async function POST(request: Request) {
  return guarded(async () => {
    await requireOps();
    const body = await request.json().catch(() => null);
    const number = body?.number?.trim();
    const region = body?.region?.trim();
    const trunkName = body?.trunkName?.trim();
    const accountId = body?.accountId || null;

    if (!number || !region || !trunkName) {
      return NextResponse.json({ error: "number, region and trunkName are required" }, { status: 400 });
    }

    const phoneNumber = await prisma.phoneNumber.create({
      data: { number, region, trunkName, accountId },
    });
    return NextResponse.json({ phoneNumber }, { status: 201 });
  });
}
