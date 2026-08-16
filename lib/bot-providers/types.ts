/**
 * Interface between a campaign's assigned bot config and the Asterisk
 * dialplan extension that answers a connected call. Kept as an interface
 * (rather than inlined into the dialer engine) so ivay's voice AI backend
 * can evolve — new engine versions, regional variants, etc. — without
 * touching campaign/dialer/portal code.
 */

export type BotSessionContext = {
  campaignId: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  /** Asterisk channel name the bot session is bound to, for transfer/hangup control. */
  channel: string;
};

export type BotSessionHandle = {
  /** Opaque id the engine uses to reference this session in later calls. */
  sessionId: string;
};

export interface BotProviderAdapter {
  readonly provider: "IVAY_VOICE";

  /** Called when a lead's call connects and the bot should start talking. */
  startSession(ctx: BotSessionContext, config: Record<string, unknown>): Promise<BotSessionHandle>;

  /** Called on hangup/transfer to let the engine clean up its session. */
  endSession(handle: BotSessionHandle): Promise<void>;
}
