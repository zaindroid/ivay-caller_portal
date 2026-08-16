export async function register() {
  // Only wire the AMI listener in the actual running Node server, not during
  // `next build` (which also loads instrumentation.ts) or the edge runtime.
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  if (process.env.NEXT_RUNTIME === "nodejs" && !isBuildPhase) {
    const { wireAmiEvents } = await import("@/lib/dialer/engine");
    wireAmiEvents();
  }
}
