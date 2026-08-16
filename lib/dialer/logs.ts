export type LogLevel = "info" | "warn" | "error";
export type LogEntry = { ts: string; level: LogLevel; msg: string };

const globalForLogs = globalThis as unknown as { dialerLogBuffer?: LogEntry[] };
const buffer: LogEntry[] = globalForLogs.dialerLogBuffer ?? (globalForLogs.dialerLogBuffer = []);

const MAX_ENTRIES = 500;

export function addLog(level: LogLevel, msg: string) {
  const entry: LogEntry = { ts: new Date().toISOString(), level, msg };
  buffer.unshift(entry);
  if (buffer.length > MAX_ENTRIES) buffer.pop();
  if (level === "error") console.error(`[dialer:${level}] ${msg}`);
  else console.log(`[dialer:${level}] ${msg}`);
}

export function getLogs(limit = 100, level?: LogLevel) {
  const filtered = level ? buffer.filter((l) => l.level === level) : buffer;
  return filtered.slice(0, limit);
}
