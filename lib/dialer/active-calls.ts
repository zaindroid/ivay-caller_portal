/**
 * A lightweight in-process registry of calls this portal has placed and that
 * haven't reported completion yet. Bland's own /v1/calls/active endpoint
 * doesn't return our per-call metadata, so this is what lets the Live Calls
 * page label an in-progress call with the campaign, agent, and number it
 * belongs to. Entries self-expire so a missed completion webhook can't leave
 * a call "live" forever.
 *
 * Same globalThis-buffer shape as lib/dialer/logs.ts -- fine for a single
 * long-lived Node process; it is not a durable store and is not meant to be.
 */

export type TrackedCall = {
  callId: string;
  to: string;
  label: string;
  campaignId?: string;
  startedAt: string;
};

const globalForCalls = globalThis as unknown as { activeCallRegistry?: Map<string, TrackedCall> };
const registry: Map<string, TrackedCall> =
  globalForCalls.activeCallRegistry ?? (globalForCalls.activeCallRegistry = new Map());

const TTL_MS = 30 * 60 * 1000; // a call can't realistically outlive this

function sweep() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, c] of registry) {
    if (new Date(c.startedAt).getTime() < cutoff) registry.delete(id);
  }
}

export function trackCall(call: Omit<TrackedCall, "startedAt">) {
  registry.set(call.callId, { ...call, startedAt: new Date().toISOString() });
}

export function untrackCall(callId: string) {
  registry.delete(callId);
}

export function getTrackedCalls(): TrackedCall[] {
  sweep();
  return [...registry.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
