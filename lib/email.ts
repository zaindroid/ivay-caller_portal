/**
 * Sends the post-call scheduling follow-up via Resend's HTTP API directly
 * (no SDK dependency -- just fetch) once a call ends with a confirmed
 * next-step and email address. Real email delivery, not a stub: if
 * RESEND_API_KEY isn't set this throws, and the caller (lib/dialer/engine.ts)
 * logs and swallows it rather than failing the webhook.
 */

const RESEND_API_BASE = "https://api.resend.com";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export async function sendSchedulingEmail(input: { to: string; name?: string; schedulingLink: string }): Promise<void> {
  const apiKey = requireEnv("RESEND_API_KEY");
  const from = process.env.RESEND_FROM_EMAIL || "Ivay <onboarding@resend.dev>";
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";

  const res = await fetch(`${RESEND_API_BASE}/emails`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: "Grab a time to talk with Ivay",
      text: `${greeting}\n\nThanks for the call -- here's a link to book a time that works for you:\n${input.schedulingLink}\n\nTalk soon,\nIvay`,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || `Email send failed (${res.status})`);
  }
}
