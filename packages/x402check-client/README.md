# x402check-client

Call [x402check](https://x402check.dev) **before any x402 payment** so agents default to safe pays.

Returns `ok` | `caution` | `avoid` plus `payTo`, `priceUsd`, and **history** (uptime, payToChanges, priceChanges) for one seller URL — or a batch when you need to compare tools.

Opt-in helpers `wrapFetch` and `createAxiosRequestInterceptor` auto-preflight every request URL before your x402 payment client settles. **Those helpers pay x402check** (1 free regular check ever per agent wallet, then **$0.01**/URL Exact USDC on Base). They do not pay the seller.

Use it when you need to:

- gate every settle / `PAYMENT-SIGNATURE`
- answer “is this API a scam?” / “is this x402 endpoint safe?”
- check before paying any x402 settle
- verify payTo before signing USDC on Base
- detect price or wallet drift
- check uptime / whether a seller is down
- compare candidates (cheapest / most reliable)
- keep a budget guard or audit trail

Not a wallet OFAC/drainer/simulation product — this checks the **endpoint’s live 402 + history**.

## Install

```bash
npm install x402check-client
```

## Usage

```js
import { preflight, assertPayable, withPreflightPay, wrapFetch, createAxiosRequestInterceptor } from 'x402check-client';

process.env.X402CHECK_URL = 'https://x402check.dev';

const check = await preflight('https://seller.example/api');
assertPayable(check); // throws on avoid

const pay = withPreflightPay(async (url) => {
  /* your x402 settle */
});
await pay('https://seller.example/api');
```

### Auto-check with fetch (opt-in)

```js
import { wrapFetch } from 'x402check-client';
import { wrapFetchWithPayment, x402Client } from '@x402/fetch';

// Pays x402check $0.01 (or uses the 1 free check / wallet) before each seller call.
const checkedFetch = wrapFetch(fetch, {
  baseUrl: 'https://x402check.dev',
  // paymentHeaders: { 'PAYMENT-SIGNATURE': '...' },
});
const fetchWithPayment = wrapFetchWithPayment(checkedFetch, client);
await fetchWithPayment('https://seller.example/api');
```

### Auto-check with Axios (opt-in)

```js
import axios from 'axios';
import { createAxiosRequestInterceptor } from 'x402check-client';

axios.interceptors.request.use(
  createAxiosRequestInterceptor({ baseUrl: 'https://x402check.dev' }),
);
// then add your @x402/axios payment interceptor
```

## Env

- `X402CHECK_URL` — origin of the deployed worker (required unless you pass `opts.baseUrl`)
- `X402CHECK_SKIP=1` — kill-switch (returns a synthetic ok)

## API

- `preflight(sellerUrl, opts?)` → `ToolCheck`
- `preflightBatch(sellerUrls, opts?)` → batch result
- `assertPayable(check, { allowCaution? })`
- `withPreflightPay(payFn, opts?)` — wrap a pay function so preflight runs first
- `wrapFetch(fetchImpl?, opts?)` — opt-in fetch wrapper; **pays x402check** per seller URL
- `createAxiosRequestInterceptor(opts?)` — opt-in Axios request interceptor; **pays x402check** per seller URL

**1 free regular check per wallet**, then **$0.01**/URL Exact USDC on Base. Optional deep check **$0.05**. Optional watch **$5**/30d.

- Docs: https://x402check.dev/llms.txt
- Live stats: https://x402check.dev/stats
- Agent instructions: https://x402check.dev/AGENTS.md
