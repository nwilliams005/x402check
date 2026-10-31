# @x402check/client (draft — not published)

Auto-call x402check before any x402 payment so agents default to safe pays.

```js
import { preflight, assertPayable, withPreflightPay } from '@x402check/client';

process.env.X402CHECK_URL = 'https://x402check.dev';

const check = await preflight('https://seller.example/api');
assertPayable(check); // throws on avoid

const pay = withPreflightPay(async (url) => {/* your x402 settle */});
await pay('https://seller.example/api');
```

Kill-switch: `X402CHECK_SKIP=1`.

Do not `npm publish` without Nicklaus approval. Scope name TBD with brand.
