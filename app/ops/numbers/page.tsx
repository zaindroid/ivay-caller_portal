"use client";

import { useCallback, useState } from "react";
import { Card, Button, Field, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePolling } from "@/hooks/use-polling";

type Account = { id: string; name: string };
type PhoneNumber = { id: string; number: string; region: string; trunkName: string; account: Account | null };

export default function NumbersPage() {
  const toast = useToast();
  const [numbers, setNumbers] = useState<PhoneNumber[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [number, setNumber] = useState("");
  const [region, setRegion] = useState("");
  const [trunkName, setTrunkName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [numRes, accRes] = await Promise.all([fetch("/api/ops/numbers"), fetch("/api/ops/accounts")]);
    setNumbers((await numRes.json()).numbers ?? []);
    setAccounts((await accRes.json()).accounts ?? []);
  }, []);

  usePolling(load);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/ops/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, region, trunkName, accountId: accountId || null }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error, "error");
      toast(`Number ${number} added`);
      setNumber("");
      setRegion("");
      setTrunkName("");
      setAccountId("");
      load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Phone Numbers</h1>

      <Card title="Provision a number">
        <form onSubmit={create} className="grid grid-cols-4 gap-4">
          <Field label="Number" hint="+1...">
            <input className={inputClass} value={number} onChange={(e) => setNumber(e.target.value)} required />
          </Field>
          <Field label="Region">
            <input className={inputClass} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="US-East" required />
          </Field>
          <Field label="Trunk name" hint="Internal label — not used for Bland-routed numbers">
            <input className={inputClass} value={trunkName} onChange={(e) => setTrunkName(e.target.value)} placeholder="bland" required />
          </Field>
          <Field label="Assign to account" hint="Optional">
            <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">— unassigned —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="col-span-4">
            <Button type="submit" variant="success" disabled={creating}>
              {creating ? "Adding…" : "Add number"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        {numbers === null ? (
          <p className="text-sm text-text-faint">Loading…</p>
        ) : numbers.length === 0 ? (
          <p className="text-sm text-text-faint">No numbers provisioned yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-faint">
                <th className="py-2">Number</th>
                <th className="py-2">Region</th>
                <th className="py-2">Trunk</th>
                <th className="py-2">Account</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((n) => (
                <tr key={n.id} className="border-b border-border last:border-0">
                  <td className="py-2 font-mono">{n.number}</td>
                  <td className="py-2 text-text-dim">{n.region}</td>
                  <td className="py-2 text-text-dim">{n.trunkName}</td>
                  <td className="py-2 text-text-dim">{n.account?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
