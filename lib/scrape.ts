/**
 * Turns a public profile/company URL into plain-text background the agent
 * can use to personalize a call -- no LLM step, just fetch + strip markup.
 * Seeds `{{contact_background}}` (see lib/prompt-compiler.ts).
 *
 * Works for pages that serve real content to an anonymous request: company
 * "About" pages, personal sites, blog bios, press pages. It does NOT work
 * for LinkedIn -- LinkedIn serves a login/cookie wall to anyone not signed
 * in, so a fetch just gets boilerplate. Those hosts are rejected up front
 * with a message telling the user to paste details in by hand instead.
 */

const MAX_BACKGROUND_CHARS = 3000;

// Hosts that gate all profile content behind a login and bot-block anonymous
// requests -- scraping them yields the consent wall, not the person.
const LOGIN_WALLED = [/(^|\.)linkedin\.com$/i, /(^|\.)facebook\.com$/i, /(^|\.)instagram\.com$/i];

// Fingerprints of a consent/login interstitial rather than real page content.
const WALL_MARKERS = [
  /respects your privacy/i,
  /use essential and non-essential cookies/i,
  /(sign|log) ?in to (linkedin|continue|see)/i,
  /please enable (javascript|cookies) to/i,
  /you must (log|sign) ?in/i,
];

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
  if (LOGIN_WALLED.some((re) => re.test(parsed.hostname))) {
    throw new Error(
      `${parsed.hostname} blocks automated profile reads. Paste the person's details into the Background box instead, or use a public page — a company About page, their bio, or a press page.`
    );
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

  // A short page that's mostly a consent/login wall is worse than nothing --
  // it would feed the agent boilerplate about cookies as "background".
  if (text.length < 600 && WALL_MARKERS.some((re) => re.test(text))) {
    throw new Error(
      "That page only returned a login or cookie wall, not real content. Paste the person's details into the Background box instead."
    );
  }

  return text.slice(0, MAX_BACKGROUND_CHARS);
}
