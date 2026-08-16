import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guarded, requireOwnedCampaign } from "@/lib/guards";
import { parseLeadsCsv, bulkImportLeads } from "@/lib/leads";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    const { id } = await params;
    await requireOwnedCampaign(id);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where: { campaignId: id },
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where: { campaignId: id } }),
    ]);
    return NextResponse.json({ leads, total });
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    const { id } = await params;
    await requireOwnedCampaign(id);

    const contentType = request.headers.get("content-type") || "";
    let imported = 0;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }
      imported = await bulkImportLeads(id, parseLeadsCsv(await file.text()));
    } else {
      const body = await request.json().catch(() => null);
      if (!body?.phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });
      imported = await bulkImportLeads(id, [
        { name: body.name?.trim() || body.phone, phone: body.phone.trim(), email: body.email?.trim() || null },
      ]);
    }

    return NextResponse.json({ loaded: imported });
  });
}
