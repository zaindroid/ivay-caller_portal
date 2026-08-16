"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, StatTile } from "@/components/ui";

type Account = { id: string; name: string; _count: { campaigns: number; users: number } };

export default function OpsDashboard() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);

  useEffect(() => {
    fetch("/api/ops/accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []));
  }, []);

  const totalCampaigns = accounts?.reduce((n, a) => n + a._count.campaigns, 0) ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Ops Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        <StatTile label="Accounts" value={accounts?.length ?? 0} />
        <StatTile label="Campaigns" value={totalCampaigns} />
        <StatTile label="Total" value={accounts?.reduce((n, a) => n + a._count.users, 0) ?? 0} />
      </div>

      <Card title="Recent accounts">
        {accounts === null ? (
          <p className="text-sm text-text-faint">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-text-faint">
            No client accounts yet.{" "}
            <Link href="/ops/accounts" className="text-primary-hi hover:underline">
              Create one
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {accounts.slice(0, 8).map((a) => (
              <li key={a.id} className="flex justify-between border-b border-border py-2 last:border-0">
                <Link href={`/ops/accounts/${a.id}`} className="font-medium text-primary-hi hover:underline">
                  {a.name}
                </Link>
                <span className="text-text-dim">{a._count.campaigns} campaigns</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
