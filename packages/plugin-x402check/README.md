# plugin-x402check

[ElizaOS](https://elizaos.ai) plugin for [x402check](https://x402check.dev) — trust-check an x402 seller **before any payment**.

Actions:

- `X402CHECK_PREFLIGHT` — single URL → `ok|caution|avoid` + history
- `X402CHECK_VERIFY_PAYTO` — receiving wallet + drift
- `X402CHECK_COMPARE_TOOLS` — compare candidate sellers

Use when the agent is about to settle / sign `PAYMENT-SIGNATURE`, asks “is this x402 endpoint safe?”, needs to verify payTo on Base, or compare tools.

## Install

```bash
npm install plugin-x402check
# or: elizaos plugins add plugin-x402check
```

```js
import x402checkPlugin from 'plugin-x402check';

const agent = {
  name: 'SafePayer',
  plugins: [x402checkPlugin],
};
```

## Settings

| Key | Default | Meaning |
|-----|---------|---------|
| `X402CHECK_URL` | `https://x402check.dev` | Worker origin |
| `X402CHECK_SKIP` | `0` | `1` = kill-switch |

Paid **$0.002 USDC Exact per tool URL** on Base. No free tier. See https://x402check.dev/llms.txt

## Not

Not a wallet OFAC/drainer/simulation product — this checks the **endpoint’s live 402 + history**.
