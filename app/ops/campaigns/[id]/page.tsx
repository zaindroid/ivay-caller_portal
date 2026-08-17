"use client";

import { use, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Card, StatTile, Pill, Button, Field, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePolling } from "@/hooks/use-polling";

type Lead = { id: string; name: string; phone: string; status: string; note: string | null };
type CampaignDetail = {
  id: string;
  name: string;
  status: string;
  maxConcurrent: number;
  phoneNumber: { number: string; region: string } | null;
  botConfig: { name: string; config: { language?: string; task?: string } } | null;
  account: { id: string; name: string };
};
type Status = { counts: Record<string, number>; ami: string };

const STAT_KEYS = ["total", "pending", "dialing", "connected", "completed", "transferred", "failed"];

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadTotal, setLeadTotal] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testCalling, setTestCalling] = useState(false);

  const load = useCallback(async () => {
    const [detailRes, leadsRes] = await Promise.all([
      fetch(`/api/ops/campaigns/${id}`),
      fetch(`/api/ops/campaigns/${id}/leads?limit=50`),
    ]);
    const detail = await detailRes.json();
    setCampaign(detail.campaign ?? null);
    setStatus(detail.status ?? null);
    const leadsData = await leadsRes.json();
    setLeads(leadsData.leads ?? []);
    setLeadTotal(leadsData.total ?? 0);
  }, [id]);

  usePolling(load, 3000);

  async function uploadCsv() {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast("Choose a CSV file first", "error");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/ops/campaigns/${id}/leads`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) return toast(data.error, "error");
      toast(`Loaded ${data.loaded} leads`);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } finally {
      setUploading(false);
    }
  }

  async function testCall(e: React.FormEvent) {
    e.preventDefault();
    if (!testPhone.trim()) return toast("Enter a phone number", "error");
    setTestCalling(true);
    try {
      const res = await fetch(`/api/ops/campaigns/${id}/test-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error, "error");
      toast(`Calling ${testPhone.trim()} now — this is a one-off test, not added to leads`);
      setTestPhone("");
    } finally {
      setTestCalling(false);
    }
  }

  async function startCampaign() {
    setBusy(true);
    try {
      const res = await fetch(`/api/ops/campaigns/${id}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) return toast(data.error, "error");
      toast("Campaign started");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function pauseCampaign() {
    setBusy(true);
    try {
      await fetch(`/api/ops/campaigns/${id}/pause`, { method: "POST" });
      toast("Campaign paused", "info");
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!campaign) return <p className="text-sm text-text-faint">Loading…</p>;

  const counts = status?.counts ?? {};

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/ops/accounts/${campaign.account.id}`} className="text-xs text-text-faint hover:text-text-dim">
          ← {campaign.account.name}
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-bold">{campaign.name}</h1>
          <Pill value={campaign.status} />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {STAT_KEYS.map((k) => (
          <StatTile key={k} label={k} value={counts[k] ?? 0} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card title="Controls" className="col-span-1">
          <div className="space-y-3">
            <Button variant="success" className="w-full justify-center" onClick={startCampaign} disabled={busy || campaign.status === "ACTIVE"}>
              Start
            </Button>
            <Button variant="warn" className="w-full justify-center" onClick={pauseCampaign} disabled={busy || campaign.status !== "ACTIVE"}>
              Pause
            </Button>
            <div className="pt-2 text-xs text-text-faint">
              Agent line: <span className={status?.ami === "connected" ? "text-success" : "text-danger"}>{status?.ami ?? "unknown"}</span>
            </div>
          </div>
        </Card>

        <Card title="Assignment" className="col-span-1">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-dim">Number</dt>
              <dd className="font-mono">{campaign.phoneNumber?.number ?? "— unassigned —"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-dim">Region</dt>
              <dd>{campaign.phoneNumber?.region ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-dim">Voice agent</dt>
              <dd>{campaign.botConfig?.name ?? "— unassigned —"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-dim">Language</dt>
              <dd>{campaign.botConfig?.config?.language ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-dim">Max concurrent</dt>
              <dd>{campaign.maxConcurrent}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Agent prompt" className="col-span-1">
          {campaign.botConfig?.config?.task ? (
            <p className="text-xs text-text-dim whitespace-pre-wrap">{campaign.botConfig.config.task}</p>
          ) : (
            <p className="text-xs text-text-faint">
              No prompt set — edit this campaign&apos;s voice agent on the Voice Agents page.
            </p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card title="Test call">
          <p className="mb-3 text-xs text-text-dim">
            Call any real number right now using this agent — a one-off call, not a lead. It won&apos;t appear below or count toward campaign
            stats.
          </p>
          <form onSubmit={testCall} className="space-y-3">
            <Field label="Phone number">
              <input className={inputClass} value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+1 555 123 4567" required />
            </Field>
            <Button type="submit" variant="ghost" disabled={testCalling}>
              {testCalling ? "Calling…" : "Call this number"}
            </Button>
          </form>
        </Card>

        <Card title="Upload leads (CSV)">
          <div className="flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" accept=".csv" className="text-sm text-text-dim" />
            <Button variant="ghost" onClick={uploadCsv} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload CSV"}
            </Button>
          </div>
        </Card>
      </div>

      <Card title={`Leads (${leadTotal})`}>
        {leads.length === 0 ? (
          <p className="text-sm text-text-faint">No leads uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-faint">
                  <th className="py-2">Name</th>
                  <th className="py-2">Phone</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Note</th>
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
                    <td className="py-2 text-xs text-text-faint">{l.note ?? ""}</td>
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
