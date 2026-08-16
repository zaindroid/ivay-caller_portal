import type { BotProviderAdapter, BotSessionContext, BotSessionHandle } from "./types";

/**
 * Ivay's own voice AI engine adapter. An Asterisk dialplan extension
 * bridges a connected call to this engine, which posts back to our
 * transfer webhook (/api/bot/callback) to hand off to a human agent queue.
 *
 * The engine integration itself is still being built — this adapter is the
 * scaffolding for it, not a finished integration.
 */
export class IvayVoiceAdapter implements BotProviderAdapter {
  readonly provider = "IVAY_VOICE" as const;

  async startSession(
    ctx: BotSessionContext,
    config: Record<string, unknown>
  ): Promise<BotSessionHandle> {
    const agentId = config.agentId as string | undefined;
    if (!agentId) {
      throw new Error("Voice agent config is missing agentId");
    }

    // TODO: call ivay's voice engine to start a session bound to
    // ctx.channel, once ops defines how numbers/channels bridge to it.
    return { sessionId: `ivay-${ctx.leadId}-${Date.now()}` };
  }

  async endSession(handle: BotSessionHandle): Promise<void> {
    void handle; // no-op stub — nothing to tear down until the engine is wired up
    // TODO: tell the voice engine the session ended, once the above is wired up.
  }
}
