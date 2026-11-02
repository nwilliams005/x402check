---
title: "Using x402check in CI with the GitHub Action"
description: "Fail or warn your builds when an x402 seller's price, payTo, or network drifts. Setup for the x402check Endpoint Preflight Action."
date: 2026-11-02
canonical: https://x402check.dev/blog/x402check-github-action-ci
author: Nicklaus Williams
tags: x402, CI, GitHub Actions, sellers
---

# Using x402check in CI with the GitHub Action

*By Nicklaus Williams · 2026-11-02 · originally published at [x402check.dev/blog/x402check-github-action-ci](https://x402check.dev/blog/x402check-github-action-ci)*

If you sell through x402, silent drift is the boring kind of outage. Your live 402 starts asking for a new price or a new `payTo`, the directory still shows the old numbers, and agents fail or pay the wrong wallet until someone notices.

The [x402check Endpoint Preflight](https://github.com/marketplace/actions/x402check-endpoint-preflight) GitHub Action runs the same checks in CI on a schedule or on push.

## What it does

For each URL you list, it calls x402check and compares:

- `priceUsd`
- `payTo`
- `network`

…to either explicit expected values or a baseline file from the last good run. Mode `fail` breaks the job. Mode `warn` only annotates.

## Minimal workflow

```yaml
name: x402 seller preflight
on:
  schedule:
    - cron: "0 */6 * * *"
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: nwilliams005/x402check-action@v1
        with:
          mode: fail
          payer-private-key: ${{ secrets.X402CHECK_PAYER_KEY }}
          endpoints: |
            [
              {
                "url": "https://your.example/api/tool",
                "expectedPriceUsd": 0.01,
                "expectedPayTo": "0xYourPayTo",
                "expectedNetwork": "eip155:8453"
              }
            ]
```

Store the payer key as `X402CHECK_PAYER_KEY`. Fund it with a little USDC on Base. The Action will try the **one free regular check per wallet** first, then pay **$0.01** (or **$0.05** if you set `deep: true`).

## Baseline mode

If you omit `expected*`, the Action compares to `.x402check-baseline.json` and can rewrite it after a clean run (`write-baseline: true`). That is handy when prices are intentional but you still want to catch surprise changes.

## Pair with watch

CI catches drift when GitHub runs. For email when price or `payTo` changes between runs, use the **$5 / 30 day** watch on [x402check.dev](https://x402check.dev/docs).

## Pinning

Marketplace listing: [x402check Endpoint Preflight](https://github.com/marketplace/actions/x402check-endpoint-preflight). Pin `@v1` or a commit SHA. Source: [nwilliams005/x402check-action](https://github.com/nwilliams005/x402check-action).

---

Canonical URL (set this on Medium / dev.to): https://x402check.dev/blog/x402check-github-action-ci
