"use client";

import { useCallback, useState } from "react";
import { Card, Button, Field, inputClass, Pill } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePolling } from "@/hooks/use-polling";

type BotConfigData = { language?: string; agentId?: string; greeting?: string };
type BotConfig = { id: string; name: string; config: BotConfigData };

const LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "de-DE", label: "German" },
  { code: "fr-FR", label: "French" },
  { code: "es-ES", label: "Spanish" },
];

export default function BotConfigsPage() {
  const toast = useToast();
  const [configs, setConfigs] = useState<BotConfig[] | null>(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [agentId, setAgentId] = useState("");
  const [greeting, setGreeting] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/bot-configs");
    setConfigs((await res.json()).botConfigs ?? []);
  }, []);

  usePolling(load);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/ops/bot-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, provider: "IVAY_VOICE", config: { language, agentId, greeting } }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error, "error");
      toast(`Voice agent "${name}" created`);
      setName("");
      setAgentId("");
      setGreeting("");
      load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Voice Agents</h1>
      <p className="text-sm text-text-faint">
        Ivay voice AI agents — one per language/script combination. Assign one to a campaign to power its calls.
      </p>

      <Card title="New voice agent">
        <form onSubmit={create} className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. German Outreach Agent" />
          </Field>
          <Field label="Language">
            <select className={inputClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Agent ID" hint="Internal reference for this voice agent">
            <input className={inputClass} value={agentId} onChange={(e) => setAgentId(e.target.value)} />
          </Field>
          <Field label="Opening line" hint="What the bot says when a call connects">
            <input className={inputClass} value={greeting} onChange={(e) => setGreeting(e.target.value)} placeholder="Hallo, hier ist..." />
          </Field>
          <div className="col-span-2">
            <Button type="submit" variant="success" disabled={creating}>
              {creating ? "Creating…" : "Create voice agent"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        {configs === null ? (
          <p className="text-sm text-text-faint">Loading…</p>
        ) : configs.length === 0 ? (
          <p className="text-sm text-text-faint">No voice agents yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-faint">
                <th className="py-2">Name</th>
                <th className="py-2">Language</th>
                <th className="py-2">Opening line</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2">
                    <Pill value={LANGUAGES.find((l) => l.code === c.config.language)?.label ?? c.config.language ?? "—"} />
                  </td>
                  <td className="py-2 text-text-dim">{c.config.greeting || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
