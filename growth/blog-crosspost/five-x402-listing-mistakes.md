---
title: "5 x402 listing mistakes that cost agents money"
description: "Anonymized patterns from real Bazaar and 402 Index listings that disagree with live 402 quotes: stale prices, old wallets, retired routes, and dynamic pricing."
date: 2026-11-02
canonical: https://x402check.dev/blog/five-x402-listing-mistakes
author: Nicklaus Williams
tags: x402, Bazaar, listings, agents
---

# 5 x402 listing mistakes that cost agents money

*By Nicklaus Williams · 2026-11-02 · originally published at [x402check.dev/blog/five-x402-listing-mistakes](https://x402check.dev/blog/five-x402-listing-mistakes)*

On November 2, 2026 (America/Chicago) I compared public x402 directory listings to live 402 responses and emailed or messaged owners when they disagreed. I am not naming those owners here. The patterns repeat, and they are exactly what burns agent budgets.

Below are five mistakes that showed up more than once. Counts are from that outreach pass, not a claim about the whole ecosystem.

## 1. Listed price far below the live quote

One upload style endpoint was listed around half a cent. The live 402 asked for about **$2** to the same wallet. Agents that sized a budget from the directory underpaid every time and never got the resource.

**Fix for sellers:** push discovery metadata whenever your quote table changes, or mark the listing as tiered / dynamic.

**Fix for buyers:** always read the live 402 (or run a preflight) before you sign. Treat directory prices as hints.

## 2. Stale payTo while the price looks fine

Several GPU and marketplace routes kept the listed amount but pointed `payTo` at an old wallet. Live 402s already used a new address. Price matched. Destination did not.

Agents that trust the listing can send USDC to a wallet the seller no longer monitors.

**Fix:** refresh Bazaar / index rows when you rotate settlement wallets. Buyers should compare live `payTo` to an allowlist.

## 3. Directory still shows a retired or 404 route

More than one project left routes on 402 Index after the path returned **404** or **410** ("endpoint retired"). Listings still advertised a price.

Agents waste a check, a signature attempt, or worse, keep retrying.

**Fix:** delete or replace dead rows. Point `llms.txt` and indexes at the URLs you actually serve.

## 4. Snapshot prices for model dependent quotes

Gateways that quote per model correctly return a live 402 that depends on the model id. Directories still showed a single fixed number from an old snapshot. Live quotes ranged from roughly the snapshot up to several times higher depending on the model.

The product works. The cached number lies.

**Fix:** publish a preferred probe model, or label the listing as price varies. Buyers should never settle from the snapshot alone.

## 5. Auth mismatch: index says x402, live asks for something else

At least one indexed "x402" route returned **401** with a SIWE style challenge instead of a 402 payment requirement, while a sibling route charged a tiny Exact amount that did not match the index's dollar price.

Agents that only speak x402 see a broken endpoint. Agents that trust the index price will misbudget the route that does speak 402.

**Fix:** either expose a clean 402 on the listed URL, or remove the row and document the real auth flow.

## How often did this show up?

In that Nov 2 outreach pass I contacted **10** endpoint owners across Bazaar and 402 Index after live probes disagreed with the listing. Pattern mix among those 10:

- Price mismatch: several (including one ~400x gap)
- Stale payTo: at least two product lines
- 404 / 410 listed routes: at least two
- Dynamic vs snapshot pricing: at least one
- Auth / index confusion: at least one

That is not "X% of all x402 is broken." It is "these failure modes are real and easy to hit."

## What agents should do anyway

1. Prefer live 402 over directory metadata.
2. Deny on unreachable / not a 402 when you expected payment.
3. Allowlist `payTo` when you can.
4. Cap spend per call and per day.
5. Optional: call [x402check](https://x402check.dev) before `PAYMENT-SIGNATURE` ($0.01 regular, one free check per wallet).

If you own a listing and want a free recheck after you fix it, use the free check on the site or reply to the note I sent.

---

Canonical URL (set this on Medium / dev.to): https://x402check.dev/blog/five-x402-listing-mistakes
