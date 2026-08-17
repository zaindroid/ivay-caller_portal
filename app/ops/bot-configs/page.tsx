"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, Button, Field, inputClass, Pill } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePolling } from "@/hooks/use-polling";

type BotConfigData = { language?: string; voice?: string; voiceName?: string; task?: string; firstSentence?: string };
type BotConfig = { id: string; name: string; config: BotConfigData };
type Voice = { id: string; name: string; description: string | null; tags: string[] };

const LANGUAGES = [
  { code: "en-US", label: "English (US)", previewText: "Hi, this is a preview of this voice." },
  { code: "en-GB", label: "English (UK)", previewText: "Hi, this is a preview of this voice." },
  { code: "de", label: "German", previewText: "Hallo, das ist eine Vorschau dieser Stimme." },
  { code: "fr", label: "French", previewText: "Bonjour, ceci est un aperçu de cette voix." },
  { code: "es", label: "Spanish", previewText: "Hola, esta es una vista previa de esta voz." },
];

export default function BotConfigsPage() {
  const toast = useToast();
  const [configs, setConfigs] = useState<BotConfig[] | null>(null);
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [voiceId, setVoiceId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [firstSentence, setFirstSentence] = useState("");
  const [task, setTask] = useState("");
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const [botRes, voiceRes] = await Promise.all([fetch("/api/ops/bot-configs"), fetch("/api/ops/voices")]);
    setConfigs((await botRes.json()).botConfigs ?? []);
    setVoices((await voiceRes.json()).voices ?? []);
  }, []);

  usePolling(load);

  const currentLanguage = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  const filteredVoices = useMemo(() => {
    if (!voices) return [];
    const langTag = { "en-US": "english", "en-GB": "english", de: "german", fr: "french", es: "spanish" }[language];
    const byLang = langTag ? voices.filter((v) => v.tags.some((t) => t.toLowerCase() === langTag)) : voices;
    const q = filter.trim().toLowerCase();
    const list = q ? byLang.filter((v) => v.name.toLowerCase().includes(q)) : byLang;
    // De-dupe by display name — the catalog has several near-duplicate entries.
    const seen = new Set<string>();
    return list.filter((v) => (seen.has(v.name.toLowerCase()) ? false : (seen.add(v.name.toLowerCase()), true))).slice(0, 40);
  }, [voices, language, filter]);

  async function playPreview(v: Voice) {
    setPreviewing(v.id);
    try {
      const res = await fetch("/api/ops/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: v.id, text: currentLanguage.previewText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast(data?.error || "Preview failed", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      toast("Preview failed", "error");
    } finally {
      setPreviewing(null);
    }
  }

  function selectVoice(v: Voice) {
    setVoiceId(v.id);
    setVoiceName(v.name);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!voiceId) return toast("Pick a voice first", "error");
    setCreating(true);
    try {
      const res = await fetch("/api/ops/bot-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, provider: "IVAY_VOICE", config: { language, voice: voiceId, voiceName, firstSentence, task } }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error, "error");
      toast(`Voice agent "${name}" created`);
      setName("");
      setTask("");
      setVoiceId("");
      setVoiceName("");
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
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. German Outreach Agent" />
            </Field>
            <Field label="Language">
              <select
                className={inputClass}
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setVoiceId("");
                  setVoiceName("");
                }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Voice" hint={voiceName ? `Selected: ${voiceName}` : "Pick a voice below — press ▶ to preview before choosing"}>
            <input
              className={inputClass}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter voices by name…"
            />
          </Field>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            {voices === null ? (
              <p className="p-4 text-sm text-text-faint">Loading voices…</p>
            ) : filteredVoices.length === 0 ? (
              <p className="p-4 text-sm text-text-faint">No voices match.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {filteredVoices.map((v) => (
                    <tr
                      key={v.id}
                      className={`cursor-pointer border-b border-border last:border-0 hover:bg-bg ${voiceId === v.id ? "bg-primary/10" : ""}`}
                      onClick={() => selectVoice(v)}
                    >
                      <td className="w-10 py-2 pl-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playPreview(v);
                          }}
                          disabled={previewing === v.id}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-xs text-text-dim hover:border-primary hover:text-primary-hi disabled:opacity-40"
                          title="Preview this voice"
                        >
                          {previewing === v.id ? "…" : "▶"}
                        </button>
                      </td>
                      <td className="py-2 font-medium">{v.name}</td>
                      <td className="py-2 pr-3 text-xs text-text-faint">{v.description || ""}</td>
                      {voiceId === v.id && (
                        <td className="w-16 py-2 pr-3 text-right">
                          <Pill value="selected" />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Opening line" hint="Exact words the agent starts with — leave blank to let it improvise (not recommended)">
              <input
                className={inputClass}
                value={firstSentence}
                onChange={(e) => setFirstSentence(e.target.value)}
                placeholder="Hi, this is Ivay calling — do you have a quick moment?"
              />
            </Field>
            <div />
          </div>

          <Field
            label="Agent instructions"
            hint="Full prompt — who the agent is, what it's calling about, how it should behave. Don't mention this is a test, demo, or reference any internal system."
          >
            <textarea
              className={`${inputClass} min-h-28`}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              required
              placeholder="You are calling on behalf of Ivay to follow up on..."
            />
          </Field>

          <Button type="submit" variant="success" disabled={creating}>
            {creating ? "Creating…" : "Create voice agent"}
          </Button>
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
                <th className="py-2">Voice</th>
                <th className="py-2">Opening line</th>
                <th className="py-2">Instructions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="py-2 font-medium align-top">{c.name}</td>
                  <td className="py-2 align-top">
                    <Pill value={LANGUAGES.find((l) => l.code === c.config.language)?.label ?? c.config.language ?? "—"} />
                  </td>
                  <td className="py-2 align-top text-text-dim">{c.config.voiceName || "—"}</td>
                  <td className="py-2 max-w-xs align-top text-text-dim">{c.config.firstSentence || "—"}</td>
                  <td className="py-2 max-w-md text-text-dim">{c.config.task || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
