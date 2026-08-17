"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Button, Field, inputClass, Pill } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePolling } from "@/hooks/use-polling";
import { PRESETS, getPreset, type PresetKey } from "@/lib/prompt-presets";
import { compilePrompt, type PromptFields } from "@/lib/prompt-compiler";

type BotConfigData = {
  language?: string;
  voice?: string;
  voiceName?: string;
  task?: string;
  firstSentence?: string;
  presetType?: PresetKey;
  goal?: string;
  callFlow?: string;
  background?: string;
  guardrails?: string;
  exampleDialogue?: string;
  knowledgeBaseId?: string;
  knowledgeBaseName?: string;
  knowledgeBaseStatus?: string;
};
type BotConfig = { id: string; name: string; config: BotConfigData };
type Voice = { id: string; name: string; description: string | null; tags: string[] };

const LANGUAGES = [
  { code: "en-US", label: "English (US)", previewText: "Hi, this is a preview of this voice." },
  { code: "en-GB", label: "English (UK)", previewText: "Hi, this is a preview of this voice." },
  { code: "de", label: "German", previewText: "Hallo, das ist eine Vorschau dieser Stimme." },
  { code: "fr", label: "French", previewText: "Bonjour, ceci est un aperçu de cette voix." },
  { code: "es", label: "Spanish", previewText: "Hola, esta es una vista previa de esta voz." },
];

const EMPTY_FIELDS: PromptFields = { goal: "", callFlow: "", background: "", guardrails: "", exampleDialogue: "" };

export default function BotConfigsPage() {
  const toast = useToast();
  const [configs, setConfigs] = useState<BotConfig[] | null>(null);
  const [voices, setVoices] = useState<Voice[] | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [voiceId, setVoiceId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [firstSentence, setFirstSentence] = useState("");
  const [presetKey, setPresetKey] = useState<PresetKey>("sales");
  const [fields, setFields] = useState<PromptFields>(getPreset("sales").fields);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const [kbName, setKbName] = useState("");
  const [kbUrls, setKbUrls] = useState("");
  const [kb, setKb] = useState<{ id: string; name: string; status: string } | null>(null);
  const [kbStarting, setKbStarting] = useState(false);

  const load = useCallback(async () => {
    const [botRes, voiceRes] = await Promise.all([fetch("/api/ops/bot-configs"), fetch("/api/ops/voices")]);
    setConfigs((await botRes.json()).botConfigs ?? []);
    setVoices((await voiceRes.json()).voices ?? []);
  }, []);

  usePolling(load);

  // Poll knowledge-base processing status until it settles.
  useEffect(() => {
    if (!kb || kb.status !== "PROCESSING") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/ops/knowledge-base/${kb.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setKb(data.knowledgeBase);
    }, 4000);
    return () => clearInterval(t);
  }, [kb]);

  const currentLanguage = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];
  const compiled = useMemo(() => compilePrompt(fields), [fields]);

  const filteredVoices = useMemo(() => {
    if (!voices) return [];
    const langTag = { "en-US": "english", "en-GB": "english", de: "german", fr: "french", es: "spanish" }[language];
    const byLang = langTag ? voices.filter((v) => v.tags.some((t) => t.toLowerCase() === langTag)) : voices;
    const q = filter.trim().toLowerCase();
    const list = q ? byLang.filter((v) => v.name.toLowerCase().includes(q)) : byLang;
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

  function applyPreset(key: PresetKey) {
    setPresetKey(key);
    setFields(getPreset(key).fields);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setLanguage("en-US");
    setVoiceId("");
    setVoiceName("");
    setFirstSentence("");
    setPresetKey("sales");
    setFields(getPreset("sales").fields);
    setKbName("");
    setKbUrls("");
    setKb(null);
  }

  function editConfig(c: BotConfig) {
    setEditingId(c.id);
    setName(c.name);
    setLanguage(c.config.language || "en-US");
    setVoiceId(c.config.voice || "");
    setVoiceName(c.config.voiceName || "");
    setFirstSentence(c.config.firstSentence || "");
    if (c.config.goal || c.config.callFlow || c.config.background || c.config.guardrails || c.config.exampleDialogue) {
      setPresetKey(c.config.presetType || "custom");
      setFields({
        goal: c.config.goal || "",
        callFlow: c.config.callFlow || "",
        background: c.config.background || "",
        guardrails: c.config.guardrails || getPreset("custom").fields.guardrails,
        exampleDialogue: c.config.exampleDialogue || "",
      });
    } else {
      // Legacy agent created before Prompt Studio -- preserve its working
      // freeform prompt rather than discarding it.
      setPresetKey("custom");
      setFields({ ...EMPTY_FIELDS, background: c.config.task || "", guardrails: getPreset("custom").fields.guardrails });
    }
    if (c.config.knowledgeBaseId) {
      setKb({ id: c.config.knowledgeBaseId, name: c.config.knowledgeBaseName || "Knowledge base", status: c.config.knowledgeBaseStatus || "COMPLETED" });
    } else {
      setKb(null);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function startKnowledgeBase() {
    const urls = kbUrls.split(/\s+/).map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) return toast("Add at least one URL to scrape", "error");
    setKbStarting(true);
    try {
      const res = await fetch("/api/ops/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: kbName || `${name || "Agent"} knowledge base`, urls }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error, "error");
      setKb(data.knowledgeBase);
      toast("Scraping started — this can take a minute or two");
    } finally {
      setKbStarting(false);
    }
  }

  function removeKnowledgeBase() {
    setKb(null);
    setKbName("");
    setKbUrls("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!voiceId) return toast("Pick a voice first", "error");
    if (!fields.goal.trim()) return toast("Describe the agent's goal", "error");
    setSaving(true);
    try {
      const config = {
        language,
        voice: voiceId,
        voiceName,
        firstSentence,
        presetType: presetKey,
        goal: fields.goal,
        callFlow: fields.callFlow,
        background: fields.background,
        guardrails: fields.guardrails,
        exampleDialogue: fields.exampleDialogue,
        task: compiled,
        knowledgeBaseId: kb?.id,
        knowledgeBaseName: kb?.name,
        knowledgeBaseStatus: kb?.status,
      };

      const res = await fetch(editingId ? `/api/ops/bot-configs/${editingId}` : "/api/ops/bot-configs", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { name, config } : { name, provider: "IVAY_VOICE", config }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error, "error");
      toast(editingId ? `Voice agent "${name}" updated` : `Voice agent "${name}" created`);
      resetForm();
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Prompt Studio</h1>
      <p className="text-sm text-text-faint">
        Build Ivay voice agents from a structured, grounded prompt — pick a preset, fill in the specifics, and optionally attach a
        knowledge base so the agent answers from real facts instead of guessing.
      </p>

      <Card title={editingId ? `Editing "${name}"` : "New voice agent"}>
        <form onSubmit={save} className="space-y-5">
          <div>
            <span className="mb-2 block text-sm font-medium text-text-dim">Preset</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                    presetKey === p.key ? "border-primary bg-primary/10" : "border-border hover:border-border-hi hover:bg-card-hi"
                  }`}
                >
                  <div className="font-semibold text-text">{p.label}</div>
                  <div className="mt-0.5 text-text-faint">{p.description}</div>
                </button>
              ))}
            </div>
          </div>

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

          <Field label="Opening line" hint="Exact words the agent starts with — leave blank to let it improvise (not recommended)">
            <input
              className={inputClass}
              value={firstSentence}
              onChange={(e) => setFirstSentence(e.target.value)}
              placeholder="Hi, this is Ivay calling — do you have a quick moment?"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Goal" hint="What this call is for and what success looks like">
              <textarea className={`${inputClass} min-h-20`} value={fields.goal} onChange={(e) => setFields({ ...fields, goal: e.target.value })} required />
            </Field>
            <Field label="Call flow" hint="Numbered steps the agent should generally follow">
              <textarea className={`${inputClass} min-h-20`} value={fields.callFlow} onChange={(e) => setFields({ ...fields, callFlow: e.target.value })} />
            </Field>
            <Field label="Background" hint="Facts about the business/offer the agent needs to speak accurately">
              <textarea className={`${inputClass} min-h-20`} value={fields.background} onChange={(e) => setFields({ ...fields, background: e.target.value })} />
            </Field>
            <Field label="Guardrails" hint="Rules the agent must never break">
              <textarea className={`${inputClass} min-h-20`} value={fields.guardrails} onChange={(e) => setFields({ ...fields, guardrails: e.target.value })} />
            </Field>
          </div>
          <Field label="Example dialogue" hint="A short sample exchange showing the tone and how to handle a tricky moment">
            <textarea className={`${inputClass} min-h-20`} value={fields.exampleDialogue} onChange={(e) => setFields({ ...fields, exampleDialogue: e.target.value })} />
          </Field>

          <Field label="Compiled prompt" hint="Exactly what the agent receives — read-only, built from the fields above">
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-bg p-3 font-mono text-xs text-text-dim">
              {compiled || "Fill in the fields above to see the compiled prompt."}
            </pre>
          </Field>

          <div className="rounded-lg border border-border p-4">
            <div className="mb-2 text-sm font-medium text-text-dim">Knowledge base (optional)</div>
            <p className="mb-3 text-xs text-text-faint">
              Give the agent real facts to draw on instead of guessing — paste a client&apos;s website page(s) and we&apos;ll scrape and attach
              them. No extra cost: included in your normal per-minute call rate.
            </p>
            {kb ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium text-text">{kb.name}</span>
                  <span className="ml-2 text-xs text-text-faint">{kb.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Pill value={kb.status.toLowerCase() === "completed" ? "ready" : kb.status.toLowerCase()} />
                  <Button type="button" variant="ghost" onClick={removeKnowledgeBase}>
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input className={inputClass} value={kbName} onChange={(e) => setKbName(e.target.value)} placeholder="Knowledge base name (optional)" />
                <textarea
                  className={`${inputClass} min-h-16`}
                  value={kbUrls}
                  onChange={(e) => setKbUrls(e.target.value)}
                  placeholder="https://client.com/pricing https://client.com/faq"
                />
                <Button type="button" variant="ghost" onClick={startKnowledgeBase} disabled={kbStarting}>
                  {kbStarting ? "Starting…" : "Scrape & attach"}
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="submit" variant="success" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Create voice agent"}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            )}
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
                <th className="py-2">Preset</th>
                <th className="py-2">Language</th>
                <th className="py-2">Voice</th>
                <th className="py-2">Knowledge base</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="py-2 font-medium align-top">{c.name}</td>
                  <td className="py-2 align-top text-text-dim">{getPreset(c.config.presetType || "custom").label}</td>
                  <td className="py-2 align-top">
                    <Pill value={LANGUAGES.find((l) => l.code === c.config.language)?.label ?? c.config.language ?? "—"} />
                  </td>
                  <td className="py-2 align-top text-text-dim">{c.config.voiceName || "—"}</td>
                  <td className="py-2 align-top text-text-dim">{c.config.knowledgeBaseName || "—"}</td>
                  <td className="py-2 align-top text-right">
                    <Button type="button" variant="ghost" onClick={() => editConfig(c)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
