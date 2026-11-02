# x402check

Paid per-tool trust check **before an AI agent pays** an x402 endpoint. **No free checks.** Unit **$0.002**/tool (Exact USDC on Base). Live: **https://x402check.dev**

Use when agents or people ask: *check before paying*, *is this API a scam?*, *is this x402 endpoint safe?*, *verify payTo*, *detect price/wallet drift*, *compare sellers*, *budget guard*.

Batch POST = N×unit in one Exact settlement. Live honest counts: https://x402check.dev/stats (never padded).

## Agent discovery

| Path | Purpose |
|------|---------|
| `/llms.txt` | llms.txt v2 card |
| `/llms-full.txt` | FAQ + API reference for agents |
| `/openapi.json` | OpenAPI 3.1 + `x-guidance` + `x-payment-info` + `x-keywords` |
| `/mcp` | MCP JSON-RPC (paid tools settle via `_meta['x402/payment']`) |
| `/mcp.json` | MCP descriptor |
| `/mcp/server-card` | SEP-2127 MCP Server Card |
| `/.well-known/agent-card.json` | A2A Agent Card |
| `/.well-known/x402` | x402scan compatibility |
| `/.well-known/ai-catalog.json` | Domain AI Catalog |
| `/.well-known/mcp/server-card.json` | Smithery server card |
| `/sitemap.xml` / `/robots.txt` | Search + AI crawlers |
| `/stats` | Live usage (KV + on-chain) |
| `/watch` | Optional $5/30d daily re-check + webhook |

npm: `x402check-client`, `x402check-mcp`, `x402check-langchain`, `x402check-ai-sdk`, `plugin-x402check`  
PyPI: `x402check-langchain` · MCP Registry: `dev.x402check/mcp`

See `DISCOVERY.md`, `INTENTS.md`, `GO_LIVE.md`, `DEPLOY.md`.

## Dev

```bash
npm run test:local
```

## MCP payment

`initialize` + `tools/list` are free. Paid tools (`preflight_check`, `verify_payto`, `preflight_batch`, `compare_tools`, `watch_tool`) follow [x402 MCP transport v2](https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/mcp.md):

1. Unpaid `tools/call` → `isError` + `PaymentRequired` (`structuredContent` + `content[0].text`) with the same Base Exact `accepts[]` / payTo as HTTP 402.
2. Retry with `params._meta["x402/payment"]` = PaymentPayload.
3. Success → tool result + `result._meta["x402/payment-response"]`.

Unit **$0.002** per seller URL (batch = N×unit, one Exact settlement). `watch_tool` is a fixed **$5** Exact / 30 days.
