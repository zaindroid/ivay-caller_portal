"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Button, Field, inputClass, Pill } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePolling } from "@/hooks/use-polling";
import { PcmListener, type ListenState } from "@/lib/pcm-listen";

type ActiveCall = {
  callId: string;
  to: string;
  label: string;
  startedAt: string | null;
  status: string;
};

function elapsed(from: string | null, now: number) {
  if (!from) return "";
  const s = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function LiveCallsPage() {
  const toast = useToast();
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [backendError, setBackendError] = useState<string | undefined>();
  const [now, setNow] = useState(Date.now());
  const [manualId, setManualId] = useState("");

  const [listeningId, setListeningId] = useState<string | null>(null);
  const [listenState, setListenState] = useState<ListenState | null>(null);
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const listenerRef = useRef<PcmListener | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/calls/active");
    if (!res.ok) return;
    const data = await res.json();
    setCalls(data.calls ?? []);
    setBackendError(data.backendError);
  }, []);

  usePolling(load, 3000);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const stopListening = useCallback(() => {
    listenerRef.current?.close();
    listenerRef.current = null;
    setListeningId(null);
    setListenState(null);
    setLevel(0);
  }, []);

  useEffect(() => () => listenerRef.current?.close(), []);

  // If the call we're listening to drops off the active list, tear down.
  useEffect(() => {
    if (listeningId && !calls.some((c) => c.callId === listeningId) && listenState === "listening") {
      // give it one grace poll before assuming it ended
      const t = setTimeout(() => {
        if (!calls.some((c) => c.callId === listeningId)) stopListening();
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [calls, listeningId, listenState, stopListening]);

  async function listen(callId: string) {
    if (connecting) return;
    stopListening();
    setConnecting(true);
    try {
      const res = await fetch(`/api/ops/calls/${callId}/listen`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Could not start listening", "error");
        return;
      }
      const l = new PcmListener();
      l.onState = (s, detail) => {
        setListenState(s);
        if (s === "error") toast(detail ? `Listen error: ${detail}` : "Listen connection failed", "error");
      };
      l.onLevel = setLevel;
      listenerRef.current = l;
      setListeningId(callId);
      setMuted(false);
      await l.connect(data.url);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setConnecting(false);
    }
  }

  function toggleMute() {
    const l = listenerRef.current;
    if (!l) return;
    l.setMuted(!l.muted);
    setMuted(l.muted);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Live Calls</h1>
        <p className="mt-1 text-sm text-text-dim">
          Shadow-listen to a call while it&apos;s happening. It&apos;s listen-only — neither the agent nor the person on the
          line can hear you.
        </p>
      </div>

      {backendError && (
        <Card>
          <p className="text-xs text-warn">
            Couldn&apos;t reach the telephony backend&apos;s active-call list ({backendError}). Calls placed from this portal
            still show below.
          </p>
        </Card>
      )}

      {listeningId && (
        <Card title="Now listening">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-mono text-sm text-text">
              {calls.find((c) => c.callId === listeningId)?.label ?? listeningId}
            </span>
            <Pill value={listenState === "listening" ? "connected" : listenState ?? "connecting"} />
            <div className="flex h-3 w-40 items-center gap-0.5 overflow-hidden rounded bg-bg" aria-hidden>
              {Array.from({ length: 20 }).map((_, i) => (
                <span
                  key={i}
                  className="h-full flex-1 rounded-[1px] transition-colors"
                  style={{ background: level * 20 > i ? "var(--color-success, #16a34a)" : "var(--color-border, #e5e7eb)" }}
                />
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={toggleMute}>
                {muted ? "Unmute" : "Mute"}
              </Button>
              <Button variant="danger" onClick={stopListening}>
                Stop
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card title={`Active calls (${calls.length})`}>
        {calls.length === 0 ? (
          <p className="text-sm text-text-faint">No calls in progress right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-faint">
                  <th className="py-2">Call</th>
                  <th className="py-2">Number</th>
                  <th className="py-2">Elapsed</th>
                  <th className="py-2">Status</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.callId} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium">{c.label}</td>
                    <td className="py-2 font-mono text-text-dim">{c.to || "—"}</td>
                    <td className="py-2 font-mono tabular-nums text-text-dim">{elapsed(c.startedAt, now) || "—"}</td>
                    <td className="py-2">
                      <Pill value={c.status} />
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        variant={listeningId === c.callId ? "ghost" : "primary"}
                        onClick={() => (listeningId === c.callId ? stopListening() : listen(c.callId))}
                        disabled={connecting}
                      >
                        {listeningId === c.callId ? "Listening…" : "Listen"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Listen by call ID">
        <p className="mb-3 text-xs text-text-dim">
          For a call that isn&apos;t listed above — paste its ID from the telephony dashboard.
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Field label="Call ID">
              <input className={inputClass} value={manualId} onChange={(e) => setManualId(e.target.value)} placeholder="a1b2c3…" />
            </Field>
          </div>
          <Button variant="ghost" onClick={() => manualId.trim() && listen(manualId.trim())} disabled={connecting}>
            Listen
          </Button>
        </div>
      </Card>
    </div>
  );
}
