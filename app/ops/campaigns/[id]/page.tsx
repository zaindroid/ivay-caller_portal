"use client";

import { Fragment, use, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Card, StatTile, Pill, Button, Field, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePolling } from "@/hooks/use-polling";

type Lead = {
  id: string;
  name: string;
  phone: string;
  status: string;
  note: string | null;
  background: string | null;
  externalCallId: string | null;
};
type PhoneNumber = { id: string; number: string; region: string };
type CampaignDetail = {
  id: string;
  name: string;
  status: string;
  maxConcurrent: number;
  phoneNumberId: string | null;
  phoneNumber: { id: string; number: string; region: string } | null;
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
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadTotal, setLeadTotal] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testCalling, setTestCalling] = useState(false);
  const [testContactName, setTestContactName] = useState("");
  const [testBackground, setTestBackground] = useState("");
  const [testProfileUrl, setTestProfileUrl] = useState("");
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const [recordingCallId, setRecordingCallId] = useState("");

  const load = useCallback(async () => {
    const [detailRes, leadsRes, numbersRes] = await Promise.all([
      fetch(`/api/ops/campaigns/${id}`),
      fetch(`/api/ops/campaigns/${id}/leads?limit=50`),
      fetch(`/api/ops/numbers`),
    ]);
    const detail = await detailRes.json();
    setCampaign(detail.campaign ?? null);
    setStatus(detail.status ?? null);
    const leadsData = await leadsRes.json();
    setLeads(leadsData.leads ?? []);
    setLeadTotal(leadsData.total ?? 0);
    setNumbers((await numbersRes.json()).numbers ?? []);
  }, [id]);

  async function assignNumber(phoneNumberId: string) {
    const res = await fetch(`/api/ops/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumberId: phoneNumberId || null }),
    });
    if (!res.ok) return toast((await res.json()).error ?? "Could not set number", "error");
    toast(phoneNumberId ? "Caller ID updated" : "Caller ID cleared — using the default outbound number");
    load();
  }

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
        body: JSON.stringify({
          phone: testPhone.trim(),
          contactName: testContactName.trim() || undefined,
          background: testBackground.trim() || undefined,
          profileUrl: testProfileUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error, "error");
      toast(
        data.background
          ? `Calling ${testPhone.trim()} now — scraped background applied`
          : `Calling ${testPhone.trim()} now — this is a one-off test, not added to leads`
      );
      setTestPhone("");
      setTestContactName("");
      setTestBackground("");
      setTestProfileUrl("");
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
            <div>
              <dt className="mb-1 text-text-dim">Caller ID (outbound number)</dt>
              <dd>
                <select
                  className={inputClass}
                  value={campaign.phoneNumber?.id ?? ""}
                  onChange={(e) => assignNumber(e.target.value)}
                >
                  <option value="">Default outbound number</option>
                  {numbers.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.number} · {n.region}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-text-faint">
                  Add numbers on the Numbers page. Only use a number you&apos;re authorised to present as caller ID.
                </span>
              </dd>
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
            <Field label="Contact name (optional)" hint="The agent will ask for this person by name, and handle a receptionist/gatekeeper professionally.">
              <input className={inputClass} value={testContactName} onChange={(e) => setTestContactName(e.target.value)} placeholder="Alex Rivera" />
            </Field>
            <Field
              label="Background (optional)"
              hint="Typed here, or auto-filled below from a profile URL — either way it's used to personalize the pitch to them specifically."
            >
              <textarea
                className={inputClass}
                rows={3}
                value={testBackground}
                onChange={(e) => setTestBackground(e.target.value)}
                placeholder="Runs a 12-person landscaping company, recently expanded to a second city…"
              />
            </Field>
            <Field label="…or auto-fill from a profile URL" hint="LinkedIn, company About page, etc. Scraped only if Background above is left blank.">
              <input
                className={inputClass}
                value={testProfileUrl}
                onChange={(e) => setTestProfileUrl(e.target.value)}
                placeholder="https://linkedin.com/in/…"
                disabled={!!testBackground.trim()}
              />
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

      <Card title="Play a recording by call ID">
        <p className="mb-3 max-w-2xl text-xs text-text-dim">
          Every call placed here is recorded — real leads show a Play button below, but a one-off test call isn&apos;t
          tied to a lead. Paste its call ID (shown when you placed it, and in Logs) to play it back.
        </p>
        <div className="flex max-w-lg items-end gap-3">
          <div className="flex-1">
            <Field label="Call ID">
              <input className={inputClass} value={recordingCallId} onChange={(e) => setRecordingCallId(e.target.value)} placeholder="a1b2c3…" />
            </Field>
          </div>
          <Button
            variant="ghost"
            onClick={() => recordingCallId.trim() && setPlayingCallId(playingCallId === recordingCallId.trim() ? null : recordingCallId.trim())}
          >
            {playingCallId === recordingCallId.trim() && recordingCallId.trim() ? "Hide" : "Play"}
          </Button>
        </div>
        {recordingCallId.trim() && playingCallId === recordingCallId.trim() && (
          <audio controls autoPlay className="mt-3 w-full max-w-lg" src={`/api/ops/calls/${recordingCallId.trim()}/recording`}>
            Your browser doesn&apos;t support inline audio playback.
          </audio>
        )}
      </Card>

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
                  <th className="py-2">Background</th>
                  <th className="py-2">Note</th>
                  <th className="py-2">Recording</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <Fragment key={l.id}>
                    <tr className="border-b border-border last:border-0">
                      <td className="py-2 font-medium">{l.name}</td>
                      <td className="py-2 font-mono text-text-dim">{l.phone}</td>
                      <td className="py-2">
                        <Pill value={l.status} />
                      </td>
                      <td className="py-2 max-w-xs truncate text-xs text-text-faint" title={l.background ?? ""}>
                        {l.background ?? ""}
                      </td>
                      <td className="py-2 text-xs text-text-faint">{l.note ?? ""}</td>
                      <td className="py-2">
                        {l.externalCallId ? (
                          <button
                            className="text-xs font-semibold text-primary-hi hover:underline"
                            onClick={() => setPlayingCallId(playingCallId === l.externalCallId ? null : l.externalCallId)}
                          >
                            {playingCallId === l.externalCallId ? "Hide" : "▶ Play"}
                          </button>
                        ) : (
                          <span className="text-xs text-text-faint">—</span>
                        )}
                      </td>
                    </tr>
                    {playingCallId === l.externalCallId && l.externalCallId && (
                      <tr className="border-b border-border last:border-0">
                        <td colSpan={6} className="py-2">
                          <audio controls autoPlay className="w-full" src={`/api/ops/calls/${l.externalCallId}/recording`}>
                            Your browser doesn&apos;t support inline audio playback.
                          </audio>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
