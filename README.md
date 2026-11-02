# x402check

**Check before paying any x402 seller URL** — trust-check it before your agent pays (is this API a scam / safe?).

[x402check](https://x402check.dev) is a paid preflight for the [x402](https://x402.org) HTTP 402 payment protocol. Call it with a seller URL; get back `ok` | `caution` | `avoid` plus that endpoint's live `payTo`, price, and history (uptime, payTo changes, price changes).

- **Price:** **$0.01 USDC** Exact per tool checked, on **Base** (eip155:8453); optional **deep check $0.05**; optional **watch $5 / 30 days**
- **No free live tier** — free static sample shape at [`/example`](https://x402check.dev/example)
- **Not** an OFAC / wallet-drainer / transaction-simulation product (that is a different project at x402check.xyz). This product checks the **seller endpoint's live 402 + history**.

Live site: **https://x402check.dev**

**Shipped versions (2026-11-01):** `x402check-mcp@0.1.4` · `x402check-client@0.1.3` · `x402check-langchain@0.1.3` (npm + PyPI) · `x402check-ai-sdk@0.1.2` · `plugin-x402check@0.1.3` · MCP Registry `dev.x402check/mcp@0.1.4`

| Surface | URL |
|---------|-----|
| Preflight | `GET /preflight?url=` · `POST /preflight` (batch) |
| Sample (free, static) | https://x402check.dev/example |
| Agent guide | https://x402check.dev/llms.txt |
| OpenAPI | https://x402check.dev/openapi.json |
| MCP (remote) | https://x402check.dev/mcp |
| MCP Registry | `dev.x402check/mcp` |
| npm client | [`x402check-client`](https://www.npmjs.com/package/x402check-client) |
| npm MCP bridge | [`x402check-mcp`](https://www.npmjs.com/package/x402check-mcp) |
| Vercel AI SDK | [`x402check-ai-sdk`](https://www.npmjs.com/package/x402check-ai-sdk) |
| LangChain JS | [`x402check-langchain`](https://www.npmjs.com/package/x402check-langchain) |
| ElizaOS plugin | [`plugin-x402check`](https://www.npmjs.com/package/plugin-x402check) |
| LangChain Python (PyPI) | [`x402check-langchain`](https://pypi.org/project/x402check-langchain/) |
| Cloudflare template | [x402check-cloudflare-agent](https://github.com/nwilliams005/x402check-cloudflare-agent) |

## Why agents call it

Use x402check when you need to:

- Gate every settle / `PAYMENT-SIGNATURE` with a trust verdict
- Answer “is this x402 endpoint safe / live / drifted?”
- Verify `payTo` before signing USDC
- Detect price or wallet drift vs prior checks
- Compare candidate sellers (cheapest / most reliable)
- Keep a budget guard or audit trail

## Packages in this repo

```
packages/
  x402check-client/        # npm: wrap any pay() with a preflight
  x402check-mcp/           # npm: stdio MCP bridge → https://x402check.dev/mcp
  x402check-ai-sdk/        # npm: Vercel AI SDK tools + beforePayment
  x402check-langchain/     # npm: LangChain JS tools
  x402check-langchain-py/  # PyPI-ready LangChain Python tools
  plugin-x402check/        # npm: ElizaOS plugin
```

### Client

```bash
npm install x402check-client
```

```js
import { preflight, assertPayable, withPreflightPay } from 'x402check-client';

process.env.X402CHECK_URL = 'https://x402check.dev';

const check = await preflight('https://seller.example/api');
assertPayable(check); // throws on avoid

const pay = withPreflightPay(async (url) => {
  /* your x402 settle */
});
await pay('https://seller.example/api');
```

Paid calls require an x402-capable fetch (for example `@x402/fetch` + `ExactEvmScheme`). An unpaid request returns HTTP 402 with a `PAYMENT-REQUIRED` header and a `howToPay` body.

### MCP stdio bridge

```bash
npm install -g x402check-mcp
X402CHECK_URL=https://x402check.dev x402check-mcp
```

Or in an MCP host:

```json
{
  "mcpServers": {
    "x402check": {
      "command": "npx",
      "args": ["-y", "x402check-mcp"],
      "env": { "X402CHECK_URL": "https://x402check.dev" }
    }
  }
}
```

Remote Streamable HTTP (no local bridge): `https://x402check.dev/mcp`

Tools (remote): `preflight_check`, `verify_payto`, `preflight_batch`, `compare_tools`. Each tool checked is billed at the unit price.

## AgentKit `beforePayment` example

If you use Coinbase [AgentKit](https://github.com/coinbase/agentkit)'s x402 action provider with the proposed `beforePayment` hook ([#1402](https://github.com/coinbase/agentkit/issues/1402) / [#1454](https://github.com/coinbase/agentkit/pull/1454)):

```ts
import { preflight } from 'x402check-client';

const config = {
  beforePayment: async ({ payTo, url }) => {
    const check = await preflight(url, {
      baseUrl: 'https://x402check.dev',
      // pass paymentHeaders from your x402 client so the $0.01 check settles
    });
    if (check.verdict === 'avoid') {
      return { abort: true, reason: `x402check: ${check.reasonCodes?.join(',') || 'avoid'}` };
    }
    // optionally also assert check.payTo === payTo
  },
};
```

## Honest limits

- Settles on **Base** today (Solana support in progress).
- Server speaks **x402 v2**; pure v1-only clients cannot settle.
- We do **not** publish fabricated usage numbers. Organic settles outside our own tests start at zero until agents integrate a default preflight.
- Name collision: **x402check.xyz** is a different product (wallet OFAC / sim). Ours is **x402check.dev**.

## License

MIT — see `packages/*/LICENSE`.
