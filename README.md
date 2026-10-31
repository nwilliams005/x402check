# x402check

Paid per-tool trust check before an AI agent pays an x402 endpoint. **No free checks.** Unit **$0.002**/tool (Exact USDC on Base). Live: **https://x402check.dev**

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

Draft packages (unpublished): `packages/x402check-client`, `packages/x402check-mcp`.

See `DISCOVERY.md`, `GO_LIVE.md`, `DEPLOY.md`.

## Dev

```bash
npm run test:local
```
