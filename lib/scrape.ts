/**
 * Turns a person/company profile URL (LinkedIn, company About page, etc.)
 * into plain-text background the agent can use to personalize a call --
 * no LLM summarization step, just fetch + strip markup. Good enough to seed
 * `{{contact_background}}` (see lib/prompt-compiler.ts); the agent itself
 * reads and applies it at call time.
 */

const MAX_BACKGROUND_CHARS = 3000;

export async function scrapeProfileText(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That doesn't look like a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Profile URL must be http or https");
  }

  const res = await fetch(parsed, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; IvayBot/1.0)" },
    signal: AbortSignal.timeout(10_000),
  }).catch((e: Error) => {
    throw new Error(`Couldn't reach that URL: ${e.message}`);
  });
  if (!res.ok) throw new Error(`That URL returned an error (${res.status})`);

  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) throw new Error("Couldn't find any readable text on that page");
  return text.slice(0, MAX_BACKGROUND_CHARS);
}
