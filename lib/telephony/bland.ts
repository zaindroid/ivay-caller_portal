/**
 * Thin client around Bland AI's call API. Bland is the actual telephony +
 * voice-AI engine behind campaigns now (replaces the Asterisk/AMI dial path
 * for outbound campaign calls) -- but nothing outside this module and the
 * dialer engine should know that; the ops/client UI only ever says
 * "Voice Agent" / "Ivay Voice AI", never "Bland".
 */

const BLAND_API_BASE = "https://api.bland.ai";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export type PlaceCallInput = {
  to: string;
  /** Omit to let Bland use its own default outbound number. Only needed for
   *  a BYOT (Bring Your Own Twilio) number, alongside BLAND_ENCRYPTED_KEY. */
  from?: string;
  task: string;
  voice?: string;
  language?: string;
  firstSentence?: string;
  webhookUrl: string;
  metadata: Record<string, string>;
};

export type PlaceCallResult = {
  callId: string;
};

export async function placeCall(input: PlaceCallInput): Promise<PlaceCallResult> {
  const apiKey = requireEnv("BLAND_API_KEY");
  // Only relevant when calling from a BYOT number -- Bland's own default
  // number needs neither `from` nor a Twilio encrypted_key.
  const encryptedKey = input.from ? process.env.BLAND_ENCRYPTED_KEY : undefined;

  const res = await fetch(`${BLAND_API_BASE}/v1/calls`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone_number: input.to,
      from: input.from || undefined,
      encrypted_key: encryptedKey || undefined,
      task: input.task,
      voice: input.voice || undefined,
      language: input.language || undefined,
      first_sentence: input.firstSentence || undefined,
      webhook: input.webhookUrl,
      metadata: input.metadata,
      max_duration: 15,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || `Bland call request failed (${res.status})`);
  }
  return { callId: data.call_id };
}

/** Shape of the POST body Bland sends to our webhook when a call ends. */
export type BlandWebhookPayload = {
  call_id: string;
  status?: string;
  call_length?: number;
  completed?: boolean;
  metadata?: Record<string, string> | null;
};
