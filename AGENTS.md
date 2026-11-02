# AGENTS.md — x402check

**Preflight before paying any x402 tool.**

Before settle / `PAYMENT-SIGNATURE` to a third-party x402 seller URL, call this service first:

- `GET https://x402check.dev/preflight?url=SELLER_URL`
- MCP: `preflight_check` at `https://x402check.dev/mcp`
- npm: `x402check-client` (`preflight`, opt-in `wrapFetch` / `createAxiosRequestInterceptor`)

| Verdict | Action |
| --- | --- |
| `avoid` | Do not pay |
| `caution` | Escalate / confirm |
| `ok` | Still enforce your own maxAmount |

Pricing paid to x402check: **1 free regular check ever per agent wallet**, then **$0.01** Exact USDC on Base per URL.

Live copy: https://x402check.dev/AGENTS.md · Skills: https://x402check.dev/skills.md
