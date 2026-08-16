"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";

type LogEntry = { ts: string; level: "info" | "warn" | "error"; msg: string };

const LEVEL_COLOR: Record<string, string> = {
  info: "text-primary-hi bg-primary/15",
  warn: "text-warn bg-warn/15",
  error: "text-danger bg-danger/15",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const load = () => {
      const url = filter === "all" ? "/api/ops/logs?limit=150" : `/api/ops/logs?limit=150&level=${filter}`;
      fetch(url)
        .then((r) => r.json())
        .then((d) => setLogs(d.logs ?? []));
    };
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [filter]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">System Logs</h1>

      <div className="flex gap-2">
        {["all", "info", "warn", "error"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              filter === f ? "border border-primary text-primary-hi" : "border border-border text-text-faint"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <Card>
        {logs.length === 0 ? (
          <p className="text-sm text-text-faint">No log entries.</p>
        ) : (
          <div className="max-h-[520px] space-y-1 overflow-y-auto font-mono text-xs">
            {logs.map((l, i) => (
              <div key={i} className="flex gap-3 border-b border-border py-1.5 last:border-0">
                <span className="shrink-0 text-text-faint">{new Date(l.ts).toLocaleTimeString()}</span>
                <span className={`shrink-0 rounded px-1.5 font-bold ${LEVEL_COLOR[l.level]}`}>{l.level.toUpperCase()}</span>
                <span className="text-text-dim">{l.msg}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
