import type { ReactNode } from "react";

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-5 ${className}`}>
      {title && (
        <div className="mb-4 text-xs font-bold uppercase tracking-wider text-text-faint">{title}</div>
      )}
      {children}
    </div>
  );
}

const STAT_COLORS: Record<string, string> = {
  total: "text-text",
  pending: "text-text-dim",
  dialing: "text-primary-hi",
  connected: "text-success",
  completed: "text-accent",
  failed: "text-danger",
  transferred: "text-warn",
};

export function StatTile({ label, value }: { label: string; value: number }) {
  const color = STAT_COLORS[label.toLowerCase()] ?? "text-text";
  return (
    <div className="rounded-xl border border-border bg-bg px-4 py-4 text-center">
      <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
      <div className="mt-1 text-[0.68rem] font-semibold uppercase tracking-wider text-text-faint">{label}</div>
    </div>
  );
}

const PILL_COLORS: Record<string, string> = {
  pending: "bg-slate-500/15 text-text-dim",
  dialing: "bg-primary/20 text-primary-hi",
  connected: "bg-success/15 text-success",
  completed: "bg-accent/15 text-accent",
  failed: "bg-danger/15 text-danger",
  transferred: "bg-warn/15 text-warn",
  active: "bg-success/15 text-success",
  paused: "bg-warn/15 text-warn",
  draft: "bg-slate-500/15 text-text-dim",
  available: "bg-success/15 text-success",
  busy: "bg-primary/20 text-primary-hi",
  offline: "bg-danger/15 text-danger",
  unknown: "bg-slate-500/15 text-text-dim",
};

export function Pill({ value }: { value: string }) {
  const key = value.toLowerCase();
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold tracking-wide ${PILL_COLORS[key] ?? PILL_COLORS.unknown}`}>
      {value}
    </span>
  );
}

type ButtonVariant = "primary" | "success" | "warn" | "danger" | "ghost";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:opacity-90",
  success: "bg-success text-white hover:opacity-90",
  warn: "bg-warn text-black hover:opacity-90",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "border border-border text-text-dim hover:border-border-hi hover:text-text",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-35 disabled:cursor-not-allowed ${BUTTON_STYLES[variant]} ${className}`}
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
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary";
