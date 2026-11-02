# Resend email alerts for $5 watch — setup (not live until Nicklaus finishes these steps)

**Decision (2026-11-01):** Yes — Resend is worth it for watch.

## Why

- Watch already stores `email` but only webhooks fire today. Many buyers will not run a webhook.
- Resend **Free** plan (verified https://resend.com/pricing on 2026-11-01): **$0/mo**, **3,000 transactional emails/month**, **100/day**, up to **3 verified domains**. Enough for early watch volume (daily cron + rare alerts).
- Paid Pro starts at **$20/mo / 50k emails** if we outgrow free.
- Worker code is prepared to call `https://api.resend.com/emails` with `RESEND_API_KEY`. **Not deployed** until the account + DNS + secret exist and Nicklaus says deploy.

## Signup steps (Nicklaus)

1. Create a Resend account at https://resend.com (use the Google account that owns Cloudflare / Search Console if possible).
2. In Resend → **API Keys** → create a key with **Sending access**. Copy it once. Do **not** paste it into chat.
3. In Resend → **Domains** → **Add Domain**. Prefer subdomain **`alerts.x402check.dev`** (isolates sending reputation from the apex). Region: pick closest to users (e.g. US East).
4. Verify DNS (Cloudflare) — see below.
5. After domain shows **Verified**, create a from-address such as `x402check Watch <watch@alerts.x402check.dev>`.
6. Tell TIM to set Worker secrets (he will use wrangler; he will not print the key):
   - `RESEND_API_KEY` = the API key
   - optional var `RESEND_FROM` = `x402check Watch <watch@alerts.x402check.dev>`
7. Approve a **deploy** of the Worker commit that enables email sends. Until deploy, email field is stored but no mail leaves.

## Cloudflare DNS for `alerts.x402check.dev`

Official guide: https://resend.com/docs/dashboard/domains/cloudflare (verified `200`).

**Automatic (recommended):** On the Resend domain page click **Sign in to Cloudflare** (Domain Connect). Authorize Resend; it adds records for you.

**Manual:** In Cloudflare DNS for `x402check.dev`, add **exactly** the values Resend shows (examples below are illustrative — paste Resend’s live values):

| Type | Name (Cloudflare) | Content / Mail server | Priority | Proxy |
| --- | --- | --- | --- | --- |
| MX | `send.alerts` | value from Resend (often `feedback-smtp.<region>.amazonses.com`) | `10` | N/A |
| TXT | `send.alerts` | Resend SPF, e.g. `v=spf1 include:amazonses.com ~all` | — | DNS only |
| TXT | `resend._domainkey.alerts` | Resend DKIM `p=…` value | — | **DNS Only** (grey cloud; never proxy DKIM) |

Notes from Resend’s Cloudflare guide:

- When pasting names, **omit** the apex (`x402check.dev`); Cloudflare only needs `send.alerts` / `resend._domainkey.alerts`.
- Click **Verify DNS Records** in Resend. Often ~15 minutes; can take up to 72 hours.
- Optional later: DMARC TXT on `alerts` (`v=DMARC1; p=none;…`) once mail is flowing.

## Worker behavior (this repo)

- Cron still runs daily (`0 6 * * *` UTC in `wrangler.toml`).
- On drift: POST webhook if `webhookUrl` set; **also** send Resend email if `email` set **and** `RESEND_API_KEY` is present.
- If `RESEND_API_KEY` is missing, email is skipped silently (webhook-only), so deploy without the secret is safe but email will not work.
- From address: `env.RESEND_FROM` or default `x402check Watch <watch@alerts.x402check.dev>`.

## Cost at our scale

| Watch subscribers with email | Worst-case emails/mo (1 alert/day each) | Free tier OK? |
| --- | --- | --- |
| 10 | ~300 | Yes |
| 50 | ~1,500 | Yes |
| 100 | ~3,000 | Borderline (100/day cap) |
| 200+ | upgrade to Pro $20 | — |

Most watches will alert rarely (only on payTo/price/network/availability change), so free tier lasts longer than the table.

## Do not

- Do not put the API key in git, chat, or `wrangler.toml` `[vars]`.
- Do not send marketing blasts from this domain — transactional watch alerts only.
- Do not deploy until Nicklaus completes signup + DNS + secret + explicit deploy approval.
