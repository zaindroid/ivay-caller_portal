"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Card, Button, Field, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePolling } from "@/hooks/use-polling";

type Account = {
  id: string;
  name: string;
  notifyEmail: string | null;
  status: string;
  _count: { campaigns: number; users: number };
};

export default function OpsDashboard() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/accounts");
    const data = await res.json();
    setAccounts(data.accounts ?? []);
  }, []);

  usePolling(load);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/ops/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, notifyEmail, loginEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error, "error");
      toast(`Account "${name}" created`);
      setShowForm(false);
      setName("");
      setNotifyEmail("");
      setLoginEmail("");
      setPassword("");
      load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Client Accounts</h1>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ New Account"}</Button>
      </div>

      {showForm && (
        <Card title="Create client account">
          <form onSubmit={createAccount} className="grid grid-cols-2 gap-4">
            <Field label="Company name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Notification email" hint="Reports/exports go here">
              <input className={inputClass} type="email" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} />
            </Field>
            <Field label="Portal login email">
              <input className={inputClass} type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
            </Field>
            <Field label="Portal login password">
              <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <div className="col-span-2">
              <Button type="submit" variant="success" disabled={creating}>
                {creating ? "Creating…" : "Create account"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {accounts === null ? (
          <p className="text-sm text-text-faint">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-text-faint">No client accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-faint">
                  <th className="py-2">Name</th>
                  <th className="py-2">Campaigns</th>
                  <th className="py-2">Users</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="py-3">
                      <Link href={`/ops/accounts/${a.id}`} className="font-medium text-primary-hi hover:underline">
                        {a.name}
                      </Link>
                    </td>
                    <td className="py-3 text-text-dim">{a._count.campaigns}</td>
                    <td className="py-3 text-text-dim">{a._count.users}</td>
                    <td className="py-3 text-text-dim">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
