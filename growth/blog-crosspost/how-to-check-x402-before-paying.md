---
title: "How to check an x402 endpoint before your agent pays"
description: "A practical preflight flow for AI agents that pay x402 APIs with USDC on Base: live 402, payTo, price, and what to do with ok, caution, and avoid."
date: 2026-11-02
canonical: https://x402check.dev/blog/how-to-check-x402-before-paying
author: Nicklaus Williams
tags: x402, agents, preflight, USDC, Base
---

# How to check an x402 endpoint before your agent pays

*By Nicklaus Williams · 2026-11-02 · originally published at [x402check.dev/blog/how-to-check-x402-before-paying](https://x402check.dev/blog/how-to-check-x402-before-paying)*

Your agent finds a paid tool. The server returns HTTP 402 with an amount, a payTo wallet, a network, and an asset. The next step is usually "sign and retry." That is also the step that burns money if the listing was wrong, the wallet rotated, or the route is dead.

Here is a simple preflight habit that keeps the signing step boring.

## What you are checking

You are not asking a blacklist whether a wallet is "evil." You are asking the seller URL what it demands **right now**, and whether that matches what you expected.

Useful signals:

- Does the URL answer with a real 402?
- What is the live `payTo`?
- What is the live price in USDC?
- Has `payTo` or price changed since the last time you saw this URL?
- Is the endpoint reachable at all?

x402check returns those as a compact `ok` / `caution` / `avoid` verdict plus history for that URL only.

## The policy that actually works

| Verdict | What your agent should do |
| --- | --- |
| `avoid` | Do not pay. Pick another tool or stop. |
| `caution` | Escalate. Ask a human, tighten the budget, or probe again. |
| `ok` | You may proceed, but still enforce your own max amount and allowlist. |

`ok` is not a blessing. It means the live 402 looks consistent with what we know. Your spend caps still matter.

## Three ways to call it

**HTTP**

```bash
curl "https://x402check.dev/preflight?url=https%3A%2F%2Fseller.example%2Ftool"
```

Unauthenticated calls return 402 from x402check itself. One free regular check per wallet is available through `/preflight/free*`. After that, a regular check is **$0.01** Exact USDC on Base. A deep check is **$0.05**. Watching a URL for 30 days is **$5**.

**MCP**

Point your client at `https://x402check.dev/mcp` (or run the `x402check-mcp` stdio package) and call `preflight_check` with the seller URL.

**npm**

```bash
npm install x402check-client
```

```ts
import { preflight, wrapFetch } from "x402check-client";

const check = await preflight("https://seller.example/tool");
if (check.verdict === "avoid") throw new Error(check.reasonCodes?.join(",") ?? "avoid");

// Or wrap fetch so every x402 settle is checked first:
const fetchWithCheck = wrapFetch(globalThis.fetch, { onAvoid: "throw" });
```

## Where listings go wrong

Public directories (Bazaar, 402 Index, and friends) cache a price and a wallet. Sellers change either without refreshing the listing. Agents that budget from the directory underpay, overpay, or send funds to an old address. A live 402 read catches that in one round trip.

## What this is not

x402check is not OFAC screening, not a drainer simulator, and not a legal "this is a scam" stamp. It is endpoint and history signal before you sign.

If you operate sellers yourself, pair this with the [GitHub Action](https://github.com/marketplace/actions/x402check-endpoint-preflight) so your own listings cannot drift unnoticed.

---

Canonical URL (set this on Medium / dev.to): https://x402check.dev/blog/how-to-check-x402-before-paying
