# x402check-mcp

MCP stdio bridge to the remote [x402check](https://x402check.dev) HTTP/MCP endpoint. Trust-check x402 seller URLs before paying.

Official MCP Registry name: `dev.x402check/mcp`

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

Paid per tool checked via x402 Exact USDC on Base. See https://x402check.dev/llms.txt
