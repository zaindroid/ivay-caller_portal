# Ivay Caller Portal

Multi-client outbound calling campaign portal for ivay (ivay.tech). Two role-scoped
surfaces on one Next.js app:

- **Ops Console** (`/ops`) — ivay's internal team creates client accounts, provisions
  phone numbers/regions, configures the bot per campaign, uploads leads, and runs
  campaigns against a self-hosted Asterisk PBX over AMI.
- **Client Portal** (`/portal`) — a minimal, results-focused dashboard scoped to one
  client account: campaign status, leads, call history, CSV export. No bot/number/SIP
  configuration is exposed here — that's ops-only, by design.

See `C:\Users\zain_\.claude\plans\ok-go-through-my-virtual-swan.md` for the full plan
and rationale (why this replaces the earlier single-tenant `caller_agent` prototype).

## Stack

Next.js 16 (App Router, TypeScript) · Postgres via Prisma 7 (driver adapter,
`@prisma/adapter-pg`) · self-hosted Asterisk over AMI (`asterisk-manager`) · JWT session
cookies (`jose`) — no external auth provider, since accounts are ops-provisioned only.

## Local development

Requires Docker (for Postgres + a dev Asterisk box) and Node 22+.

```bash
# 1. Start Postgres + a bare dev Asterisk (AMI only, no real trunk/dialplan)
docker compose -f docker-compose.dev.yml up -d

# 2. Install deps, apply the schema, seed demo data
npm install
npx prisma migrate deploy
npm run db:seed

# 3. Run the app
npm run dev
```

Seeded logins (from `prisma/seed.ts`):

| Role   | Email                     | Password        |
|--------|---------------------------|------------------|
| Ops    | ops@ivay.tech             | ivay-ops-dev     |
| Client | client@democlient.test    | ivay-client-dev  |

The seeded demo campaign has 3 leads and a `dev-trunk` phone number. Starting it will
run the real dialer engine against AMI — it dials out, but since the dev Asterisk has no
real PSTN trunk configured, every call correctly comes back as `FAILED` with an AMI
error, and the campaign auto-completes. That failure path (not a successful call) is
what confirms the engine's AMI wiring, DB writes, and campaign-completion logic all
work — see the plan's verification section for what a real trunk + dialplan adds.

## What's real vs. what's scaffolding

**Working end-to-end** (verified against real Asterisk AMI, not just typechecked):
login/session/role/account scoping, account & campaign CRUD, CSV + single lead
upload, the dialer engine's Originate/Hangup/OriginateResponse/Bridge event handling
and DB persistence, campaign start/pause/auto-complete, agent-extension SIP
provisioning (writes `pjsip_agents.conf` + reloads Asterisk), lead export CSV, call
history.

**Scaffolding, not finished** (intentionally, per the plan — the voice AI engine
integration itself is still being built):
- `lib/bot-providers/ivay-voice.ts` — the adapter shape is real; the actual calls into
  ivay's voice engine are stubbed (`TODO`s) pending that engine being ready to integrate.
- The production Asterisk dialplan (real PSTN trunk, the bot-answering extension, the
  agent-transfer queue) lives on the VPS, same as the original prototype — not in this
  repo. `docker/asterisk/` here is dev-only scaffolding just so AMI has something to
  connect to locally.
- `/api/bot/callback` (the multi-tenant, per-campaign-token replacement for the
  prototype's open `/api/transfer`) is implemented but untested against a real bot
  bridge, since that requires the production dialplan above.

## Deployment

Not deployed yet — per the plan, `get_platform_contract()` and
`analyze_deployment_requirements()` against zorc happen only once you say go, since
zorc cross-checks the deploy request against the repo. `Dockerfile` here builds the
standalone production image (`output: "standalone"` in `next.config.ts`) zorc would run.
