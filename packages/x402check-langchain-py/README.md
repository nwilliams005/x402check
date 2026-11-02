# x402check-langchain (Python)

LangChain tools for [x402check](https://x402check.dev) — **check before paying** any x402 seller.

Use when your agent asks: *is this API a scam?*, *is this x402 endpoint safe?*, *verify payTo before signing USDC*, or needs a budget guard / compare tools.

Returns `ok` | `caution` | `avoid` plus history (uptime, payToChanges, priceChanges). Endpoint live 402 + history — not wallet OFAC/simulation.

```bash
pip install x402check-langchain
```

```python
from x402check_langchain import create_x402check_tools
import os
os.environ["X402CHECK_URL"] = "https://x402check.dev"
tools = create_x402check_tools()
# tools: preflight_check, verify_payto, compare_tools
```

Paid **$0.01 USDC Exact per tool URL** on Base. Optional deep check **$0.05**. No free tier.

- Docs: https://x402check.dev/llms.txt
- Live stats (honest counts only): https://x402check.dev/stats
- MCP: `npm i -g x402check-mcp` or remote `https://x402check.dev/mcp` (Registry: `dev.x402check/mcp`)
