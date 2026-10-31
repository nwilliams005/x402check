# x402check-ai-sdk

[Vercel AI SDK](https://ai-sdk.dev) tools for [x402check](https://x402check.dev) — call **before any x402 payment** so agents default to safe pays.

Returns `ok` | `caution` | `avoid` plus `payTo`, `priceUsd`, and **history** (uptime, payToChanges, priceChanges).

Use when you need to:

- gate every settle / `PAYMENT-SIGNATURE`
- answer “is this x402 endpoint safe?”
- verify payTo before signing USDC on Base
- detect price or wallet drift
- compare candidates (cheapest / most reliable)
- keep a budget guard or audit trail

Not a wallet OFAC/drainer/simulation product — this checks the **endpoint’s live 402 + history**.

## Install

```bash
npm install x402check-ai-sdk ai zod
```

## Tools

```js
import { generateText } from 'ai';
import { createX402CheckTools, beforePayment } from 'x402check-ai-sdk';

process.env.X402CHECK_URL = 'https://x402check.dev';

const tools = createX402CheckTools();
// tools.preflight_check | tools.verify_payto | tools.compare_tools

const result = await generateText({
  model: yourModel,
  tools,
  prompt: 'Is https://seller.example/x402 safe to pay?',
});
```

## beforePayment guard

```js
import { beforePayment } from 'x402check-ai-sdk';

const pay = beforePayment(async (url) => {
  /* your x402 settle */
});
await pay('https://seller.example/x402'); // throws on avoid
```

## Env

- `X402CHECK_URL` — origin (default prod: set to `https://x402check.dev`)
- `X402CHECK_SKIP=1` — kill-switch (synthetic ok)

Paid **$0.002 USDC Exact per tool URL** on Base. No free tier. See https://x402check.dev/llms.txt
