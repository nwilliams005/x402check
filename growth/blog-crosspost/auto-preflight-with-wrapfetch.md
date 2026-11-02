---
title: "One line that checks every x402 payment before it goes through"
description: "How wrapFetch on x402check-client adds a check before paying so agents and apps do not settle blind."
date: 2026-11-02
canonical: https://x402check.dev/blog/auto-preflight-with-wrapfetch
author: Nicklaus Williams
tags: x402, npm, agents, wrapFetch
---

# One line that checks every x402 payment before it goes through

*By Nicklaus Williams · 2026-11-02 · originally published at [x402check.dev/blog/auto-preflight-with-wrapfetch](https://x402check.dev/blog/auto-preflight-with-wrapfetch)*

Most agent stacks already wrap `fetch` to attach a payment signature when they see HTTP 402. The missing line is "ask whether this seller looks sane before we sign."

`x402check-client` 0.1.5 adds that as an opt in wrapper.

## Install

```bash
npm install x402check-client
```

## wrapFetch

```ts
import { wrapFetch } from "x402check-client";

const fetchPaid = wrapFetch(globalThis.fetch, {
  onAvoid: "throw",      // or "return-check"
  onCaution: "allow",    // or "throw" / "return-check"
  maxAmountUsd: 0.05,    // optional extra guard on the seller's live price
});

// Use fetchPaid anywhere your agent used to call fetch for x402 sellers.
const res = await fetchPaid("https://seller.example/tool");
```

On an `avoid` verdict the wrapper refuses to continue into payment. On `ok` it still lets your existing x402 payment wrapper do the Exact USDC settle on Base.

## Axios

```ts
import axios from "axios";
import { createAxiosRequestInterceptor } from "x402check-client";

axios.interceptors.request.use(createAxiosRequestInterceptor({ onAvoid: "throw" }));
```

## MCP and AGENTS.md

If your agent reads project instructions, drop in [AGENTS.md](https://x402check.dev/AGENTS.md) or the skill at `/.well-known/agent-skills/x402-preflight/SKILL.md`. The rule is the same: preflight before paying.

Remote MCP: `https://x402check.dev/mcp`  
Registry: `dev.x402check/mcp`

## Cost

- 1 free regular check ever per wallet
- then $0.01 per URL on Base USDC Exact
- optional deep check $0.05
- optional watch $5 / 30 days

No fabricated uptime claims, no public dump of other people's endpoints. You get the verdict and history for the URL you asked about.

---

Canonical URL (set this on Medium / dev.to): https://x402check.dev/blog/auto-preflight-with-wrapfetch
