"use client";

import { useEffect } from "react";

/**
 * Runs `fn` once on mount, then every `intervalMs` if provided. Every ops/
 * portal dashboard page uses this same fetch-on-mount(+poll) shape; centralizing
 * it here keeps the react-hooks/set-state-in-effect suppression in one place
 * instead of repeated across every page (the pattern is intentional — these
 * are live status dashboards, not effects synchronizing external systems).
 */
export function usePolling(fn: () => void, intervalMs?: number) {
  useEffect(() => {
    fn();
    if (!intervalMs) return;
    const t = setInterval(fn, intervalMs);
    return () => clearInterval(t);
  }, [fn, intervalMs]);
}
