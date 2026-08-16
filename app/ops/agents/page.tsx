"use client";

import { useCallback, useState } from "react";
import { Card, Button, Field, inputClass, Pill } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePolling } from "@/hooks/use-polling";

type Agent = { extension: number; name: string; password: string; state?: string };

export default function AgentsPage() {
  const toast = useToast();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [extension, setExtension] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/agents");
    setAgents((await res.json()).agents ?? []);
  }, []);

  usePolling(load, 5000);

  async function addAgent(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/ops/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extension, name, password }),
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error, "error");
      toast(`Agent ${extension} added`);
      setExtension("");
      setName("");
      setPassword("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function removeAgent(ext: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/ops/agents/${ext}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return toast(data.error, "error");
      toast(`Agent ${ext} removed`);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Human Agent Extensions</h1>
      <p className="text-sm text-text-faint">
        SIP extensions calls get transferred to when the bot hands off a live conversation.
      </p>

      <Card title="Add agent extension">
        <form onSubmit={addAgent} className="grid grid-cols-4 gap-4">
          <Field label="Extension" hint="1000–9999">
            <input className={inputClass} type="number" min={1000} max={9999} value={extension} onChange={(e) => setExtension(e.target.value)} required />
          </Field>
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="SIP password">
            <input className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="success" disabled={busy} className="w-full justify-center">
              Add
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        {agents === null ? (
          <p className="text-sm text-text-faint">Loading…</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-text-faint">No agent extensions configured.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-faint">
                <th className="py-2">Ext</th>
                <th className="py-2">Name</th>
                <th className="py-2">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.extension} className="border-b border-border last:border-0">
                  <td className="py-2 font-mono font-bold">{a.extension}</td>
                  <td className="py-2">{a.name}</td>
                  <td className="py-2">
                    <Pill value={a.state ?? "unknown"} />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => removeAgent(a.extension)}
                      className="rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-xs text-danger hover:bg-danger/20"
                    >
                      Remove
                    </button>
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
