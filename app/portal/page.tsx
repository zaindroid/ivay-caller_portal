import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, Pill } from "@/components/ui";

export default async function PortalHome() {
  const user = await getCurrentUser();
  if (!user?.accountId) redirect("/login");

  const campaigns = await prisma.campaign.findMany({
    where: { accountId: user.accountId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true },
  });

  if (campaigns.length === 1) redirect(`/portal/campaigns/${campaigns[0].id}`);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Your Campaigns</h1>
      <Card>
        {campaigns.length === 0 ? (
          <p className="text-sm text-text-faint">No campaigns set up yet — your ivay account manager will get you started.</p>
        ) : (
          <ul className="space-y-2">
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between border-b border-border py-3 last:border-0">
                <Link href={`/portal/campaigns/${c.id}`} className="font-medium text-primary-hi hover:underline">
                  {c.name}
                </Link>
                <Pill value={c.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
