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
  /** Knowledge base ids the agent can draw on mid-call instead of guessing. */
  knowledgeBaseIds?: string[];
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
      knowledge_base_ids: input.knowledgeBaseIds?.length ? input.knowledgeBaseIds : undefined,
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

export type Voice = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  service: string;
};

// /v2/tts (the preview endpoint) only supports these newer voice models --
// LEGACY and plain BTTS voices work for actual calls but 400 on preview.
const PREVIEWABLE_SERVICES = new Set(["BTTS_V2", "BTTS_V3"]);

export async function listVoices(): Promise<Voice[]> {
  const apiKey = requireEnv("BLAND_API_KEY");
  const res = await fetch(`${BLAND_API_BASE}/v1/voices`, {
    headers: { authorization: apiKey },
  });
  if (!res.ok) throw new Error(`Failed to list voices (${res.status})`);
  const data = await res.json();
  return (data.voices || [])
    .filter((v: { service: string }) => PREVIEWABLE_SERVICES.has(v.service))
    .map((v: { id: string; name: string; description: string | null; tags?: string[]; service: string }) => ({
      id: v.id,
      name: v.name.trim(),
      description: v.description,
      tags: v.tags || [],
      service: v.service,
    }));
}

function wrapPcmAsWav(pcm: Buffer, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Generates a short WAV preview clip of a voice speaking `text`. */
export async function previewVoice(voiceId: string, text: string): Promise<Buffer> {
  const apiKey = requireEnv("BLAND_API_KEY");
  const res = await fetch(`${BLAND_API_BASE}/v2/tts`, {
    method: "POST",
    headers: { authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice: voiceId }),
  });
  if (!res.ok) throw new Error(`Voice preview failed (${res.status})`);
  const sampleRate = parseInt(res.headers.get("x-sample-rate") || "48000", 10);
  const pcm = Buffer.from(await res.arrayBuffer());
  return wrapPcmAsWav(pcm, sampleRate);
}

// ── Knowledge base (grounds an agent in a client's real content instead of
// letting it invent answers) ─────────────────────────────────────────────

export type KnowledgeBaseStatus = "PROCESSING" | "COMPLETED" | "FAILED" | "DELETED";

export type KnowledgeBase = {
  id: string;
  name: string;
  status: KnowledgeBaseStatus;
};

/** Scrapes a client's website (same-domain linked pages included, up to
 * 100 URLs) and vectorizes it into a knowledge base the agent can draw on
 * mid-call via `tools`. Processing is async -- poll getKnowledgeBase(). */
export async function learnFromWebsite(name: string, urls: string[], description?: string): Promise<KnowledgeBase> {
  const apiKey = requireEnv("BLAND_API_KEY");
  const res = await fetch(`${BLAND_API_BASE}/v1/knowledge/learn`, {
    method: "POST",
    headers: { authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "web", name, urls, description }),
  });
  const data = await res.json();
  if (!res.ok || data?.errors) throw new Error(data?.errors?.[0]?.message || data?.data?.message || `Knowledge base creation failed (${res.status})`);
  return { id: data.data.knowledge_base_id, name, status: "PROCESSING" };
}

export async function getKnowledgeBase(id: string): Promise<KnowledgeBase> {
  const apiKey = requireEnv("BLAND_API_KEY");
  const res = await fetch(`${BLAND_API_BASE}/v1/knowledge/${id}`, {
    headers: { authorization: apiKey },
  });
  const data = await res.json();
  if (!res.ok || data?.errors) throw new Error(data?.errors?.[0]?.message || `Failed to fetch knowledge base (${res.status})`);
  return { id, name: data.data.name, status: data.data.status };
}
