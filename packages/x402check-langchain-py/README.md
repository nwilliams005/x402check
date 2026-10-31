# x402check-langchain (Python)

LangChain tools for [x402check](https://x402check.dev) — trust-check an x402 seller **before any payment**.

```bash
pip install x402check-langchain
```

```python
from x402check_langchain import create_x402check_tools
import os
os.environ["X402CHECK_URL"] = "https://x402check.dev"
tools = create_x402check_tools()
```

Tools: `preflight_check`, `verify_payto`, `compare_tools`.

Paid **$0.002 USDC Exact per tool URL** on Base. See https://x402check.dev/llms.txt

## Note

This package is prepared for PyPI. Publishing requires a PyPI API token (not present in this environment).
