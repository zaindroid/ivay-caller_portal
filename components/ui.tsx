import type { ReactNode } from "react";
import { AudioPulse } from "./audio-pulse";

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(20,22,43,0.04),0_10px_28px_-14px_rgba(20,22,43,0.14)] ${className}`}>
      {title && <div className="mb-4 text-xs font-bold uppercase tracking-wider text-text-faint">{title}</div>}
      {children}
    </div>
  );
}

const STAT_COLORS: Record<string, string> = {
  total: "text-text",
  pending: "text-text-dim",
  dialing: "text-primary-hi",
  connected: "text-success",
  completed: "text-info",
  failed: "text-danger",
  transferred: "text-warn",
};

const LIVE_STATS = new Set(["dialing", "connected"]);

export function StatTile({ label, value }: { label: string; value: number }) {
  const key = label.toLowerCase();
  const color = STAT_COLORS[key] ?? "text-text";
  const live = LIVE_STATS.has(key) && value > 0;
  return (
    <div className="rounded-xl border border-border bg-bg px-4 py-4 text-center transition-colors hover:border-border-hi">
      <div className="flex items-center justify-center gap-2">
        <div className={`font-mono text-3xl font-bold tabular-nums ${color}`}>{value}</div>
        {live && <AudioPulse className={color} />}
      </div>
      <div className="mt-1 text-[0.68rem] font-semibold uppercase tracking-wider text-text-faint">{label}</div>
    </div>
  );
}

const PILL_COLORS: Record<string, string> = {
  pending: "bg-text-faint/15 text-text-dim",
  dialing: "bg-primary/20 text-primary-hi",
  connected: "bg-success/15 text-success",
  completed: "bg-info/15 text-info",
  failed: "bg-danger/15 text-danger",
  transferred: "bg-warn/15 text-warn",
  active: "bg-success/15 text-success",
  paused: "bg-warn/15 text-warn",
  draft: "bg-text-faint/15 text-text-dim",
  available: "bg-success/15 text-success",
  busy: "bg-primary/20 text-primary-hi",
  offline: "bg-danger/15 text-danger",
  unknown: "bg-text-faint/15 text-text-dim",
};

const LIVE_PILLS = new Set(["dialing", "connected", "active"]);

export function Pill({ value }: { value: string }) {
  const key = value.toLowerCase();
  const live = LIVE_PILLS.has(key);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold tracking-wide ${PILL_COLORS[key] ?? PILL_COLORS.unknown}`}
    >
      {live && <AudioPulse />}
      {value}
    </span>
  );
}

type ButtonVariant = "primary" | "success" | "warn" | "danger" | "ghost";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hi",
  success: "bg-success text-white hover:brightness-110",
  warn: "bg-warn text-white hover:brightness-110",
  danger: "bg-danger text-white hover:brightness-110",
  ghost: "border border-border text-text-dim hover:border-border-hi hover:text-text hover:bg-card-hi",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text-dim">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-text-faint">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none transition-colors focus:border-primary";
