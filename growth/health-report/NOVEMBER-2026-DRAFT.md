# x402 listing health notes · November 2026 (DRAFT · do not deploy)

**Status:** Draft for Nicklaus review. Not on the blog yet.  
**Author:** Nicklaus Williams  
**As of:** November 2, 2026, America/Chicago  

## What this is

A monthly note with **aggregate** signals only. No endpoint URLs, no owner names, no payTo addresses. The checker stays the product; raw scan rows stay private.

## Methodology for this first edition

On Nov 2 I compared public Bazaar and 402 Index rows to live 402 responses while preparing owner outreach. Private `scan:ep:*` KV had no stored rows yet, so these numbers come from that outreach probe set, not from a finished full-catalog crawl.

I contacted **10** owners whose live behavior disagreed with the listing. The percentages below are **of that set of 10**, not of all x402 listings on earth.

## Aggregate counts (outreach set)

| Signal | Count in outreach set | Share of the 10 |
| --- | --- | --- |
| Price mismatch (listed vs live) | 5 | 50% |
| Stale payTo | 3 | 30% |
| Listed route returned 404 or 410 | 3 | 30% |
| Dynamic live quote vs fixed snapshot | 1 | 10% |
| Auth / protocol mismatch vs index | 1 | 10% |

Buckets overlap. One endpoint can land in more than one row.

## What buyers should take away

1. Directory prices are hints.
2. Always read the live 402 before signing.
3. Allowlist payTo when you reuse a seller.
4. Cap spend at signing time.

## What sellers should take away

1. Refresh discovery metadata when price or wallet changes.
2. Delete retired paths from indexes.
3. Label model-dependent quotes as variable.
4. Optional: run the x402check GitHub Action in CI and/or a $5/30d watch.

## Honest limits

- This is not an ecosystem-wide rate.
- x402check does not publish a public heat map of other people's endpoints.
- Next month the generator script (`scripts/health-report.mjs`) can roll up private scan grades into the same aggregate shape once cron has filled `scan:ep:*`.

## Links

- How-to: https://x402check.dev/blog/how-to-check-x402-before-paying  
- Listing mistakes: https://x402check.dev/blog/five-x402-listing-mistakes  
- Product: https://x402check.dev  

 ·  Nicklaus Williams
