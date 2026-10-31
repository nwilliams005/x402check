# x402check

Paid per-tool trust check before an AI agent pays an x402 endpoint. **No free checks.** Unit **$0.002**/tool (Exact USDC on Base or Solana). Live: **https://x402check.dev**

Batch POST = N×unit in one Exact settlement.

## Agent discovery

| Path | Purpose |
|------|---------|
| `/llms.txt` | llms.txt v2 card |
| `/openapi.json` | OpenAPI 3.1 + `x-guidance` + `x-payment-info` |
| `/mcp` | MCP JSON-RPC |
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
