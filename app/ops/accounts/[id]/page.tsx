"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { Card, Button, Field, inputClass, Pill } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePolling } from "@/hooks/use-polling";

type PhoneNumber = { id: string; number: string; region: string };
type BotConfigOpt = { id: string; name: string };
type Campaign = { id: string; name: string; status: string; phoneNumber: PhoneNumber | null; botConfig: BotConfigOpt | null };
type AccountDetail = {
  id: string;
  name: string;
  notifyEmail: string | null;
  phoneNumbers: PhoneNumber[];
  campaigns: Campaign[];
  users: { id: string; email: string; role: string }[];
};

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [botConfigs, setBotConfigs] = useState<BotConfigOpt[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [maxConcurrent, setMaxConcurrent] = useState("3");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [botConfigId, setBotConfigId] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [accRes, numRes, botRes] = await Promise.all([
      fetch(`/api/ops/accounts/${id}`),
      fetch("/api/ops/numbers"),
      fetch("/api/ops/bot-configs"),
    ]);
    const accData = await accRes.json();
    setAccount(accData.account ?? null);
    const numData = await numRes.json();
    setNumbers(numData.numbers ?? []);
    const botData = await botRes.json();
    setBotConfigs(botData.botConfigs ?? []);
  }, [id]);

  usePolling(load);

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/ops/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: id,
          name: campaignName,
          maxConcurrent,
          phoneNumberId: phoneNumberId || null,
          botConfigId: botConfigId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error, "error");
      toast(`Campaign "${campaignName}" created`);
      setShowForm(false);
      setCampaignName("");
      load();
    } finally {
      setCreating(false);
    }
  }

  if (!account) return <p className="text-sm text-text-faint">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/ops/accounts" className="text-xs text-text-faint hover:text-text-dim">
          ← Accounts
        </Link>
        <h1 className="mt-1 text-xl font-bold">{account.name}</h1>
        {account.notifyEmail && <p className="text-sm text-text-dim">{account.notifyEmail}</p>}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card title="Portal users">
          <ul className="space-y-2 text-sm">
            {account.users.map((u) => (
              <li key={u.id} className="flex justify-between">
                <span>{u.email}</span>
                <Pill value={u.role} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Assigned numbers">
          {account.phoneNumbers.length === 0 ? (
            <p className="text-sm text-text-faint">None yet — assign one from the Numbers page.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {account.phoneNumbers.map((n) => (
                <li key={n.id} className="flex justify-between">
                  <span className="font-mono">{n.number}</span>
                  <span className="text-text-dim">{n.region}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Campaigns</h2>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ New Campaign"}</Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={createCampaign} className="grid grid-cols-2 gap-4">
            <Field label="Campaign name">
              <input className={inputClass} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} required />
            </Field>
            <Field label="Max concurrent calls">
              <input
                className={inputClass}
                type="number"
                min={1}
                max={50}
                value={maxConcurrent}
                onChange={(e) => setMaxConcurrent(e.target.value)}
              />
            </Field>
            <Field label="Phone number" hint="Assign later if not decided yet">
              <select className={inputClass} value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)}>
                <option value="">— none —</option>
                {numbers.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.number} ({n.region})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bot config" hint="Assign later if not decided yet">
              <select className={inputClass} value={botConfigId} onChange={(e) => setBotConfigId(e.target.value)}>
                <option value="">— none —</option>
                {botConfigs.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="col-span-2">
              <Button type="submit" variant="success" disabled={creating}>
                {creating ? "Creating…" : "Create campaign"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {account.campaigns.length === 0 ? (
          <p className="text-sm text-text-faint">No campaigns yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-faint">
                <th className="py-2">Name</th>
                <th className="py-2">Status</th>
                <th className="py-2">Number</th>
                <th className="py-2">Bot</th>
              </tr>
            </thead>
            <tbody>
              {account.campaigns.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="py-3">
                    <Link href={`/ops/campaigns/${c.id}`} className="font-medium text-primary-hi hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-3">
                    <Pill value={c.status} />
                  </td>
                  <td className="py-3 font-mono text-text-dim">{c.phoneNumber?.number ?? "—"}</td>
                  <td className="py-3 text-text-dim">{c.botConfig?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
