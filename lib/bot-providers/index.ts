import type { BotProviderAdapter } from "./types";
import { IvayVoiceAdapter } from "./ivay-voice";

export type { BotProviderAdapter, BotSessionContext, BotSessionHandle } from "./types";

const registry: Record<string, BotProviderAdapter> = {
  IVAY_VOICE: new IvayVoiceAdapter(),
};

export function getBotProvider(provider: string): BotProviderAdapter {
  const adapter = registry[provider];
  if (!adapter) throw new Error(`No bot provider registered for "${provider}"`);
  return adapter;
}
