# x402check-mcp

MCP stdio bridge to the remote [x402check](https://x402check.dev) HTTP/MCP endpoint.

**Check before paying** any x402 seller URL: verdict `ok|caution|avoid` + history (uptime, payTo/price changes).

Answers agent prompts like *is this API a scam?*, *is this x402 endpoint safe?*, *verify payTo before signing*, *check before paying*.

Official MCP Registry name: `dev.x402check/mcp`

## Tools (remote)

- `preflight_check` — single URL trust preflight (check before paying)
- `verify_payto` — verify receiving wallet / payTo history (same per-URL billing)
- `preflight_batch` — up to 25 URLs
- `compare_tools` — compare candidates (same billing as batch)
- `watch_tool` — optional $5 Exact / 30d daily re-check + webhook

Use for: is this API a scam, is this endpoint safe, verify payTo, uptime, price drift, compare/cheapest, budget guard, debug failing 402.

Live honest usage: https://x402check.dev/stats

## Install

```bash
npm install -g x402check-mcp
```

## Run

```bash
X402CHECK_URL=https://x402check.dev x402check-mcp
```

Or in an MCP host config:

```json
{
  "mcpServers": {
    "x402check": {
      "command": "npx",
      "args": ["-y", "x402check-mcp"],
      "env": {
        "X402CHECK_URL": "https://x402check.dev"
      }
    }
  }
}
```

Remote Streamable HTTP (no local bridge): `https://x402check.dev/mcp`

Paid **per tool checked** via x402 Exact USDC on Base. No free tier. See https://x402check.dev/llms.txt

## MCP payment (remote)

The stdio bridge forwards JSON-RPC as-is to `POST $X402CHECK_URL/mcp`, including `params._meta`.

Per [transports-v2/mcp.md](https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/mcp.md):

1. Unpaid `tools/call` → `isError` + `PaymentRequired` (`structuredContent.accepts` = Base Exact, same payTo as HTTP).
2. Client retries with `params._meta["x402/payment"]` = PaymentPayload.
3. Success → tool data + `result._meta["x402/payment-response"]`.

`initialize` / `tools/list` stay free. Local bypass for tests: `X402CHECK_BYPASS=1`.
