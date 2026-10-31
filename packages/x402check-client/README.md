# x402check-client

Call [x402check](https://x402check.dev) before any x402 payment so agents default to safe pays.

Returns `ok` | `caution` | `avoid` plus `payTo`, price, and history for one seller URL (or a batch).

## Install

```bash
npm install x402check-client
```

## Usage

```js
import { preflight, assertPayable, withPreflightPay } from 'x402check-client';

process.env.X402CHECK_URL = 'https://x402check.dev';

const check = await preflight('https://seller.example/api');
assertPayable(check); // throws on avoid

const pay = withPreflightPay(async (url) => {
  /* your x402 settle */
});
await pay('https://seller.example/api');
```

## Env

- `X402CHECK_URL` — origin of the deployed worker (required unless you pass `opts.baseUrl`)
- `X402CHECK_SKIP=1` — kill-switch (returns a synthetic ok)

## API

- `preflight(sellerUrl, opts?)` → `ToolCheck`
- `preflightBatch(sellerUrls, opts?)` → batch result
- `assertPayable(check, { allowCaution? })`
- `withPreflightPay(payFn, opts?)` — wrap a pay function so preflight runs first

Paid per tool checked via x402 Exact USDC on Base. See https://x402check.dev/llms.txt
