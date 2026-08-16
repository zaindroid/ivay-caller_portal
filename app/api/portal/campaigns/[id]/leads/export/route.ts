import { prisma } from "@/lib/db";
import { guarded, requireOwnedCampaign } from "@/lib/guards";
import { leadsToCsv } from "@/lib/leads";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    const { id } = await params;
    const campaign = await requireOwnedCampaign(id);
    const leads = await prisma.lead.findMany({ where: { campaignId: id }, orderBy: { createdAt: "asc" } });
    const csv = leadsToCsv(leads);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${campaign.name.replace(/[^a-z0-9-_]+/gi, "_")}-leads.csv"`,
      },
    });
  });
}
