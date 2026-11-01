# x402check

Paid per-tool trust check before an AI agent pays an x402 endpoint. **No free checks.** Unit **$0.002**/tool (Exact USDC on Base). Live: **https://x402check.dev**

Batch POST = N×unit in one Exact settlement.

## Agent discovery

| Path | Purpose |
|------|---------|
| `/llms.txt` | llms.txt v2 card |
| `/openapi.json` | OpenAPI 3.1 + `x-guidance` + `x-payment-info` |
| `/mcp` | MCP JSON-RPC (paid tools settle via `_meta['x402/payment']`) |
| `/mcp.json` | MCP descriptor |
| `/.well-known/agent-card.json` | A2A Agent Card |
| `/.well-known/x402` | x402scan compatibility |
| `/.well-known/mcp/server-card.json` | Smithery server card |

npm packages: `x402check-client`, `x402check-mcp` (see `packages/`). Publish needs npm 2FA/granular token.

See `DISCOVERY.md`, `GO_LIVE.md`, `DEPLOY.md`.

## Dev

```bash
npm run test:local
```

## MCP payment

`initialize` + `tools/list` are free. Paid tools (`preflight_check`, `verify_payto`, `preflight_batch`, `compare_tools`) follow [x402 MCP transport v2](https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/mcp.md):

1. Unpaid `tools/call` → `isError` + `PaymentRequired` (`structuredContent` + `content[0].text`) with the same Base Exact `accepts[]` / payTo as HTTP 402.
2. Retry with `params._meta["x402/payment"]` = PaymentPayload.
3. Success → tool result + `result._meta["x402/payment-response"]`.

Unit **$0.002** per seller URL (batch = N×unit, one Exact settlement).
