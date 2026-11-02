# x402check-langchain

[LangChain JS](https://js.langchain.com) / LangGraph tools for [x402check](https://x402check.dev) — trust-check an x402 seller **before any payment**.

Returns `ok` | `caution` | `avoid` plus `payTo`, `priceUsd`, and history (uptime, payToChanges, priceChanges).

Use when you need to:

- gate every settle / `PAYMENT-SIGNATURE`
- answer “is this API a scam?” / “is this x402 endpoint safe?”
- check before paying any x402 settle
- verify payTo before signing USDC on Base
- compare candidates; keep a budget guard

## Install

```bash
npm install x402check-langchain @langchain/core zod
```

## Usage

```js
import { x402checkTools, beforePayment } from 'x402check-langchain';

process.env.X402CHECK_URL = 'https://x402check.dev';

const tools = x402checkTools();
// bind tools to your LangChain / LangGraph agent

const pay = beforePayment(async (url) => { /* settle */ });
await pay('https://seller.example/x402');
```

## Tools

| Name | Purpose |
|------|---------|
| `preflight_check` | Single-URL trust preflight |
| `verify_payto` | Focus on receiving wallet + drift |
| `compare_tools` | Batch compare candidates |

## Env

- `X402CHECK_URL` — set to `https://x402check.dev`
- `X402CHECK_SKIP=1` — kill-switch

Paid **$0.01 USDC Exact per tool URL** on Base. Optional deep check **$0.05**. See https://x402check.dev/llms.txt
