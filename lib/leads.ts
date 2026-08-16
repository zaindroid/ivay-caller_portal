import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/db";

export type ParsedLead = { name: string; phone: string; email: string | null };

/** Ported from the prototype's CSV upload handler (phone normalization, name fallback). */
export function parseLeadsCsv(csvText: string): ParsedLead[] {
  const rows: Record<string, string>[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const leads: ParsedLead[] = [];
  for (const row of rows) {
    let phone = (row.phone || row.Phone || row.number || row.Number || Object.values(row)[0] || "")
      .replace(/\s+/g, "")
      .replace(/[^\d+]/g, "");
    if (phone && !phone.startsWith("+")) phone = "+1" + phone;
    if (!phone) continue;
    const name = row.name || row.Name || row.first_name || phone;
    const email = row.email || row.Email || null;
    leads.push({ name, phone, email });
  }
  return leads;
}

export async function bulkImportLeads(campaignId: string, leads: ParsedLead[]) {
  if (leads.length === 0) return 0;
  const result = await prisma.lead.createMany({
    data: leads.map((l) => ({ campaignId, name: l.name, phone: l.phone, email: l.email })),
  });
  return result.count;
}

export function leadsToCsv(leads: { name: string; phone: string; email: string | null; status: string; note: string | null }[]) {
  const header = "name,phone,email,status,note";
  const lines = leads.map((l) =>
    [l.name, l.phone, l.email ?? "", l.status, (l.note ?? "").replace(/,/g, ";")]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...lines].join("\n");
}
