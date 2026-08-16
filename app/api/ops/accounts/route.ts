import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireOps, guarded } from "@/lib/guards";

export async function GET() {
  return guarded(async () => {
    await requireOps();
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { campaigns: true, users: true } } },
    });
    return NextResponse.json({ accounts });
  });
}

export async function POST(request: Request) {
  return guarded(async () => {
    await requireOps();
    const body = await request.json().catch(() => null);
    const name = body?.name?.trim();
    const notifyEmail = body?.notifyEmail?.trim() || null;
    const loginEmail = body?.loginEmail?.trim().toLowerCase();
    const password = body?.password;

    if (!name || !loginEmail || !password) {
      return NextResponse.json(
        { error: "name, loginEmail and password are required" },
        { status: 400 }
      );
    }

    const account = await prisma.account.create({
      data: {
        name,
        notifyEmail,
        users: {
          create: {
            email: loginEmail,
            passwordHash: await hashPassword(password),
            role: "CLIENT",
          },
        },
      },
      include: { users: true },
    });

    return NextResponse.json({ account }, { status: 201 });
  });
}
