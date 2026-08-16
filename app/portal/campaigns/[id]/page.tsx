"use client";

import { use, useCallback, useRef, useState } from "react";
import { Card, StatTile, Pill, Button, Field, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePolling } from "@/hooks/use-polling";

type Lead = { id: string; name: string; phone: string; status: string; note: string | null };
type Call = { id: string; outcome: string; endedAt: string; lead: { name: string; phone: string } };
type Status = { counts: Record<string, number> };

const STAT_KEYS = ["total", "pending", "dialing", "connected", "completed", "transferred", "failed"];

export default function ClientCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const [name, setCampaignName] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [tab, setTab] = useState<"leads" | "history">("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadTotal, setLeadTotal] = useState(0);
  const [calls, setCalls] = useState<Call[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [phone, setPhone] = useState("");
  const [leadName, setLeadName] = useState("");

  const loadStatus = useCallback(async () => {
    const res = await fetch(`/api/portal/campaigns/${id}`);
    const data = await res.json();
    setCampaignName(data.campaign?.name ?? "");
    setStatus(data.status ?? null);
  }, [id]);

  const loadLeads = useCallback(async () => {
    const res = await fetch(`/api/portal/campaigns/${id}/leads?limit=100`);
    const data = await res.json();
    setLeads(data.leads ?? []);
    setLeadTotal(data.total ?? 0);
  }, [id]);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/portal/campaigns/${id}/history`);
    const data = await res.json();
    setCalls(data.calls ?? []);
  }, [id]);

  const refresh = useCallback(() => {
    loadStatus();
    if (tab === "leads") loadLeads();
    if (tab === "history") loadHistory();
  }, [loadStatus, loadLeads, loadHistory, tab]);

  usePolling(refresh, 4000);

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    const res = await fetch(`/api/portal/campaigns/${id}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: leadName, phone }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error, "error");
    toast("Lead added");
    setPhone("");
    setLeadName("");
    loadLeads();
  }

  async function uploadCsv() {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast("Choose a CSV file first", "error");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/portal/campaigns/${id}/leads`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) return toast(data.error, "error");
      toast(`Loaded ${data.loaded} leads`);
      if (fileRef.current) fileRef.current.value = "";
      loadLeads();
    } finally {
      setUploading(false);
    }
  }

  const counts = status?.counts ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{name || "Campaign"}</h1>
        <a href={`/api/portal/campaigns/${id}/leads/export`}>
          <Button variant="ghost">Export leads CSV</Button>
        </a>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {STAT_KEYS.map((k) => (
          <StatTile key={k} label={k} value={counts[k] ?? 0} />
        ))}
      </div>

      <div className="flex gap-2">
        {(["leads", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${
              tab === t ? "border border-primary text-primary-hi" : "border border-border text-text-faint"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "leads" && (
        <div className="space-y-6">
          <Card title="Add leads">
            <form onSubmit={addLead} className="mb-4 flex flex-wrap items-end gap-3">
              <Field label="Name">
                <input className={inputClass} value={leadName} onChange={(e) => setLeadName(e.target.value)} />
              </Field>
              <Field label="Phone">
                <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1..." />
              </Field>
              <Button type="submit" variant="success">
                Add lead
              </Button>
            </form>
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <input ref={fileRef} type="file" accept=".csv" className="text-sm text-text-dim" />
              <Button variant="ghost" onClick={uploadCsv} disabled={uploading}>
                {uploading ? "Uploading…" : "Upload CSV instead"}
              </Button>
            </div>
          </Card>

          <Card title={`Leads (${leadTotal})`}>
            {leads.length === 0 ? (
              <p className="text-sm text-text-faint">No leads yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-faint">
                    <th className="py-2">Name</th>
                    <th className="py-2">Phone</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0">
                      <td className="py-2 font-medium">{l.name}</td>
                      <td className="py-2 font-mono text-text-dim">{l.phone}</td>
                      <td className="py-2">
                        <Pill value={l.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === "history" && (
        <Card title="Call history">
          {calls.length === 0 ? (
            <p className="text-sm text-text-faint">No completed calls yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-faint">
                  <th className="py-2">Lead</th>
                  <th className="py-2">Phone</th>
                  <th className="py-2">Outcome</th>
                  <th className="py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium">{c.lead.name}</td>
                    <td className="py-2 font-mono text-text-dim">{c.lead.phone}</td>
                    <td className="py-2">
                      <Pill value={c.outcome} />
                    </td>
                    <td className="py-2 text-text-faint">{new Date(c.endedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
