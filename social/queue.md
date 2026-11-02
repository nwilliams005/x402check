# Content queue — @x402checkdev

14 ready originals. Status: `ready` → mark `posted` + URL in `posted.log` after publish. Weighted length verified with URL=23, emoji/CJK=2 (script in `daily_procedure.md`). Target ≤270 for headroom; hard max 280.

Do **not** post launch-thread duplicates of the pinned thread (already live). Do **not** invent stats. `/stats` and $5/30d watch are live — only cite real /stats numbers; never invent.

---

## Q01 — Safety tip (payTo) — 266

**Format:** tip · **Status:** ready · **Best window:** 08:00–11:00 CT

```
Check before paying: before your agent signs an x402 USDC payment, verify the live payTo.

A compromised proxy or lookalike can name its own address in the 402. Caps alone don't catch that.

x402check returns ok | caution | avoid (is this API a scam/safe?).
https://x402check.dev
```

---

## Q02 — How it works — 251

**Format:** explainer · **Status:** ready · **Best window:** 08:00–11:00 CT

```
x402check scores two things before your agent pays:

1. The seller's live 402 (price, network, payTo)
2. That payTo's check history (uptime, price/payTo changes)

Verdict: ok | caution | avoid
$0.002 USDC on Base. No free tier.
https://x402check.dev
```

---

## Q03 — Agent card (MCP) — 234

**Format:** agent-readable · **Status:** ready · **Best window:** any; good for agent scrapers overnight too

```
Agents: check before paying any x402 seller (is this API a scam/safe?).

MCP: https://x402check.dev/mcp
npm: x402check-mcp@0.1.3
Tools: preflight_check, verify_payto, compare_tools, watch_tool

$0.002 Exact USDC/URL on Base. Live stats: /stats
Docs: https://x402check.dev/llms.txt
```

---

## Q04 — What it is / isn't — 249

**Format:** boundaries · **Status:** ready

```
What x402check is: a pre-payment check of the live 402 challenge and that payTo's history.

What it is not: OFAC screening, tx simulation, or escrow.

Pair it with your own spend caps. Disclosure: this account is the project.
https://x402check.dev
```

---

## Q05 — npm / plugins — 218

**Format:** install · **Status:** ready

```
One-liner for Node agents that pay over x402:

npm i x402check-client

Also: x402check-ai-sdk (Vercel AI SDK), x402check-langchain, plugin-x402check (Cloudflare Agents).

$0.002 / check on Base.
https://x402check.dev
```

---

## Q06 — Price clarity — 205

**Format:** pricing · **Status:** ready

```
Price is the product: $0.002 USDC per tool URL on Base. No free tier, no accounts.

Agents pay the same whether they hit the site or MCP (https://x402check.dev/mcp).

npm: x402check-mcp
https://x402check.dev
```

---

## Q07 — Caps vs preflight — 199

**Format:** tip · **Status:** ready

```
Spend caps answer "how much."
x402check answers "is this endpoint/payTo looking right now."

A sudden payTo change or empty history → caution or avoid, before the agent signs.
https://x402check.dev
```

---

## Q08 — Tool names for agents — 237

**Format:** agent-readable · **Status:** ready

```
For agent builders wiring x402 on Base:

preflight_check → probe live 402 + history
verify_payto → score one address
compare_tools → side-by-side URLs

MCP remote: https://x402check.dev/mcp
$0.002 USDC / check. This account is the project.
```

---

## Q09 — Coming /stats — 211

**Format:** coming · **Status:** ready · Hold until work on /stats has started publicly, or post as roadmap tease once (then wait for ship post)

```
Coming next on x402check.dev: a public /stats page.

Planned: checks run, tools flagged caution/avoid, no fabricated vanity numbers — only what we can show from real traffic.

Site today: https://x402check.dev
```

---

## Q10 — Coming $5 watch — 232

**Format:** coming · **Status:** ready · Post once; do not repeat daily

```
Coming: a $5/mo watch subscription.

Re-check a tool URL on a schedule and alert when its payTo or price changes. Same Base USDC rails as the $0.002 one-shot check.

Interest? Reply. Product page will land on https://x402check.dev
```

---

## Q11 — Why Base 402 alone isn't enough — 234

**Format:** tip · **Status:** ready

```
x402 on Base settles USDC. The 402 body names payTo, price, and network.

Nothing in that response proves the address belongs to the seller you think you're calling.

That's the gap x402check fills before sign.
https://x402check.dev
```

---

## Q12 — Failure mode (payTo flip) — 238

**Format:** safety finding (product behavior, not a fabricated incident) · **Status:** ready

```
Failure mode we built for: the 402 looks fine, but payTo flipped since yesterday.

x402check compares the live challenge to that seller's history and returns caution/avoid when price or payTo jumps.
$0.002 / check.
https://x402check.dev
```

---

## Q13 — Plugin map — 251

**Format:** install · **Status:** ready

```
Plugin map for agents that already pay with x402:

• MCP — x402check-mcp / https://x402check.dev/mcp
• Vercel AI SDK — x402check-ai-sdk
• LangChain — x402check-langchain
• Cloudflare Agents — plugin-x402check
• ElizaOS — via plugin

$0.002 USDC on Base.
```

---

## Q14 — compare_tools tip — 231

**Format:** tip · **Status:** ready

```
Tip: before your agent pays two similar x402 tools, compare them.

compare_tools returns side-by-side live 402s + history so you see which payTo is stable and which just changed.
MCP tool name: compare_tools
https://x402check.dev/mcp
```

---

## Rotation notes

Suggested first week order (skip any already covered by the pinned launch thread that day):

Mon Q01 · Tue Q03 · Wed Q07 · Thu Q05 · Fri Q12 · Sat Q08 · Sun Q04  
Next: Q02, Q06, Q11, Q13, Q14, then Q09/Q10 once each.

After the queue drains: write fresh posts from `/stats`, watch waitlist replies, AgentKit news, or a real ecosystem safety note — never recycle identical text.
