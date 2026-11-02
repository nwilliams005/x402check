# Resend email alerts for $5 watch

**Status (2026-11-02):** Live. Domain `alerts.x402check.dev` has DKIM + SPF + MX in DNS. Worker secrets `RESEND_API_KEY` and optional `RESEND_FROM` are set. Daily watch cron calls `sendWatchEmail` on drift.

## Current config

| Item | Value |
| --- | --- |
| From | `x402check Watch <watch@alerts.x402check.dev>` (default if `RESEND_FROM` unset) |
| Domain | `alerts.x402check.dev` |
| API | `https://api.resend.com/emails` via `src/watch.ts` `sendWatchEmail` |
| Plan note | Resend Free: 3,000 emails/mo, 100/day (verify on resend.com/pricing) |

## DNS (already applied)

| Type | Name (Cloudflare) | Purpose |
| --- | --- | --- |
| MX | `send.alerts` | Resend / Forge feedback SMTP |
| TXT | `send.alerts` | SPF |
| TXT | `resend._domainkey.alerts` | DKIM (`DNS only`, never proxied) |

Official guide: https://resend.com/docs/dashboard/domains/cloudflare

## Rotate / re-set secrets

```bash
cd /workspace/x402-preflight
npx wrangler secret put RESEND_API_KEY --config wrangler.toml
# optional:
# npx wrangler secret put RESEND_FROM --config wrangler.toml
# value: x402check Watch <watch@alerts.x402check.dev>
```

Use a Resend key with **Sending** access. Domain-list APIs need a full-access key; send-only keys are fine for production alerts.

## Test send (no on-chain spend)

```bash
node scripts/test-watch-email.mjs
```

Sends one transactional alert to `nicklauswilliams25@gmail.com` through the same `sendWatchEmail` path (synthetic payload).
