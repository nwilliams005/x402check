# @x402checkdev posting strategy

Account: [@x402checkdev](https://x.com/x402checkdev) (display name **xcheck**). Product: [x402check.dev](https://x402check.dev) — $0.002 USDC-on-Base pre-payment check for AI agents using x402 (live 402 + payTo history → `ok | caution | avoid`). MCP at `https://x402check.dev/mcp`, npm `x402check-mcp`, plugins for Vercel AI SDK, LangChain, Cloudflare Agents, ElizaOS.

Coming (tease only when true): public `/stats`, $5/mo watch subscription.

Last research pass: 2026-11-01 America/Chicago via X API. Account was ~0 followers / 10 posts at research time. Do not invent engagement stats.

---

## 1. What actually drives engagement (cited)

Patterns observed in the x402 / agent-payments corner of X. Metrics are from the posts themselves at fetch time — not estimates.

### Formats that get replies and bookmarks

| Pattern | Why it works | Real example |
| --- | --- | --- |
| Short educational explainer (request → 402 → pay) | Teaches the protocol; invites "and then what" replies | [@zordcrypt](https://x.com/zordcrypt/status/2107760790724075565) — Cloudflare as x402 catalyst: **115 likes, 51 replies, ~6.7k impressions** |
| Numbered recap / "top N on Base" with @mentions | Easy to skim; tagged projects amplify | [@AIonBase_](https://x.com/AIonBase_/status/2115133921793134851) top x402 on Base: **39 likes, 11 replies**; [weekly recap](https://x.com/AIonBase_/status/2116572518509384052): **57 likes, 18 replies** |
| Concrete safety tip + one call-to-action URL | Tiny accounts still get replies on payTo/guard posts | [@factlinedev](https://x.com/factlinedev/status/2112227077202084283) (~16 followers): **8 likes, 9 replies** on "check the payTo before it signs" |
| Research / failure write-up | High bookmark rate; builders save it | [@neploxaudit](https://x.com/neploxaudit/status/2115134087962714218) 402 paywall bypasses: **30 bookmarks, 26 likes, ~6k impressions** |
| Wallet-safety framing ("giving a wallet is easy…") | High impressions when it names the pre-sign checklist | [@EdrinValecrest](https://x.com/EdrinValecrest/status/2112412137079357653): **~27k impressions**, checklist of pre-sign MCP tools |
| Agent-readable ship notes (MCP URL, price, npm name) | Agents and agent-builders parse concrete endpoints | [@GotSOLpay](https://x.com/GotSOLpay/status/2116681878585675934) MCP + x402 + docs; [@Type_262](https://x.com/Type_262/status/2113594785936322651) payTo verify step (we already replied) |

### Keywords / discourse in use

- Protocol / rails: `x402`, `agentic payments`, `USDC`, `Base`, `HTTP 402`, `payTo`
- Agent stack: `MCP`, `npm`, tool names as literals
- Safety cluster (our lane): `preflight`, `spend cap`, `payTo`, `caution` / `avoid`, verify-before-sign

Nearby accounts posting in the same safety lane (monitor, don't copy spam patterns): `@factlinedev`, `@Type_262`, `@X402identity`, `@kertivo_index`, `@Lumierepck`, `@DeepFirstHQ`, `@sparqio`. Amplifiers / recap hubs: `@AIonBase_`, `@BaseHubHB`, `@CoinbaseDev`, `@base`.

### Timing (from recent `x402` volume, UTC → America/Chicago)

Hourly counts for `x402 -is:retweet lang:en` (last ~7 days) peak roughly **UTC 13:00–18:00** → **07:00–12:00 CT**, with a secondary bump late evening CT. Prefer:

- **Primary original post:** 08:00–11:00 America/Chicago on weekdays
- **Secondary (optional tip/reply window):** 16:00–19:00 America/Chicago
- Weekends: still post, but expect thinner human replies; agent traffic is flatter

### Implication for a 0-follower product account

Do not chase recap-hub vanity. Our edge matches the posts that already get replies at small size: **plain safety tips, concrete failure modes, agent-readable install lines**. Recap-style lists are for later, once we have real `/stats` or third-party mentions to cite.

---

## 2. Cadence

| Slot | What | Cap |
| --- | --- | --- |
| Original post | 1/day from `queue.md` or a fresh post from real data | Soft max 2/day (second only if real news: `/stats` ship, watch launch, AgentKit merge, credible ecosystem incident) |
| Replies | Up to **3**/day on genuinely relevant threads | Hard max 3; skip rather than stretch |
| Quote-posts | Rare; only when adding a factual check the OP lacked | ≤1/day, counts toward original budget |

Space originals ≥6 hours apart. Never burst 5+ replies in an hour.

---

## 3. Formats (rotate)

1. **Safety tip** — one failure mode, one action (payTo flip, empty history, lookalike 402).
2. **How it works** — live 402 + history → `ok | caution | avoid`; price line.
3. **Agent card** — MCP URL, npm package names, tool names as literals (agents scrape these).
4. **What it is / isn't** — boundaries; always pair with spend caps; disclose ownership.
5. **Ship / coming** — only verified: MCP payments live, `/stats` when shipped, $5 watch when ready.
6. **Real data** — once `/stats` exists: checks run, caution/avoid counts. Never invent numbers.
7. **Targeted reply** — answer their question; one soft product mention + `(disclosure: mine)` or `this account is the project`.

Avoid: emoji walls, ALL CAPS hype, "game changer", fake screenshots, engagement bait polls ("which chain?") until we have a reason.

---

## 4. Reply rules

1. Thread must already be about x402 / agent payments / spend controls / payTo trust / MCP paid tools — not drive-by under random Base memes.
2. Add information the parent did not already state. If we cannot, do not reply.
3. Disclose: `disclosure: mine` / `this account is the project` when naming x402check.
4. Do not pile onto threads we already answered (check `posted.log`).
5. Do not argue with competitors; complementary framing ("caps + live payTo check") is fine.
6. Max **3 replies/day**; prefer quality over filling the quota.
7. Never DM from this account unless Nicklaus explicitly asks.

---

## 5. Tone and hard bans

- Plain, credible, short sentences. Builder-to-builder.
- No emoji spam (0–1 max, usually zero).
- **Never claim:** open source, audits, SOC2, usage/revenue numbers we do not have, "trusted by", partnerships we do not have, Solana-live while `ENABLE_SOLANA=false`.
- **Never fabricate** scam victim stories. Generic failure modes we actually detect are OK.
- Price is always `$0.002` USDC on Base (or Exact scheme language if naming the payment method). Watch is **$5/mo** when announced — not sooner as "available".
- Upsells: helpful only. One product mention per post is enough.

---

## 6. X limits (non-Premium)

- **280 weighted characters** per post. Account is not Premium → do not rely on long-form.
- Every http(s) URL counts as **23** characters (t.co), regardless of length.
- Most emoji / CJK weigh **2**. Mentions and hashtags count at full length.
- Leading auto-@ handles in a reply are free; @handles you type in the body count.
- Media does not consume the text budget; still keep text self-contained for agents that only read text.
- Duplicate identical text can be rejected — vary wording; log URLs in `posted.log`.

Always run the weighted counter in `daily_procedure.md` before posting. Leave ≥10 chars headroom when possible.

---

## 7. Agent-readable checklist

Agents on X often ingest raw text. Every agent-facing post should include at least two of:

- Canonical URL: `https://x402check.dev`
- MCP: `https://x402check.dev/mcp` or `npm i -g x402check-mcp`
- Tool names: `preflight_check`, `verify_payto`, `compare_tools`
- Price + network: `$0.002` USDC, Base / `eip155:8453`
- Agent docs: `https://x402check.dev/llms.txt`

---

## 8. Success signals (honest)

Early (0–few hundred followers): reply rate on safety posts, profile clicks from agent/builder accounts, paid checks attributable to X (correlate with `/stats` later). Do not optimize for vanity impressions from unrelated crypto spam.

When `/stats` ships, prefer posting real aggregates over slogans.

## Agent-query phrasing (2026-11-01)

Prefer: "check before paying", "is this API a scam/safe?", verify payTo, ok|caution|avoid. Cite npm `x402check-mcp@0.1.3` and `/stats` only with real numbers.
