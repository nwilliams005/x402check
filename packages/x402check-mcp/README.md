# x402check-mcp

MCP stdio bridge to the remote [x402check](https://x402check.dev) HTTP/MCP endpoint.

Trust-check x402 seller URLs **before paying**: verdict `ok|caution|avoid` + history (uptime, payTo/price changes).

Official MCP Registry name: `dev.x402check/mcp`

## Tools (remote)

- `preflight_check` — single URL trust preflight
- `verify_payto` — verify receiving wallet / payTo history (same per-URL billing)
- `preflight_batch` — up to 25 URLs
- `compare_tools` — compare candidates (same billing as batch)

Use for: is this endpoint safe, verify payTo, uptime, price drift, compare/cheapest, budget guard, debug failing 402.

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
