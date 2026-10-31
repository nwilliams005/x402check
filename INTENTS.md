# x402check intent map

How agents, LLM hosts, and humans find and choose x402check.
Research basis (2026-10-31 America/Chicago): CDP Bazaar semantic search + MCP `search_resources`, MCP `tools/list` description matching, x402scan/OpenAPI `x-guidance`, llms.txt, A2A agent cards, and user prompts into ChatGPT/Claude/Perplexity.

Product facts we can claim (and must not overclaim):
- Paid per tool URL checked ($0.002 Exact USDC on Base or Solana). No free tier.
- Returns `ok|caution|avoid` + that tool's history only (checks, uptimePct, payToChanges, priceChanges, recent).
- Read-only GET probe of the seller; we never pay the target.
- Differentiator vs x402check.xyz: we score the **endpoint's live 402 challenge and history**, not OFAC/drainer/simulation of a wallet.

---

## Categories and phrasings (70+)

### A. Pre-payment gate (agent runtime)
1. before paying any x402 endpoint
2. before PAYMENT-SIGNATURE to a third-party seller
3. call preflight before settle
4. trust check before facilitator settle
5. don't pay until verified
6. mandatory check before every x402 payment
7. wrap pay() with a preflight
8. default-on safety middleware for x402 clients
9. refuse payment when verdict is avoid
10. confirm with human when verdict is caution

### B. Legitimacy / scam / rug language
11. is this x402 endpoint safe
12. is this API legit or a scam
13. is this paid agent tool a rug
14. detect wallet rotation / payTo swap
15. detect sudden price hike before pay
16. has this seller changed payTo
17. has this seller changed price
18. flag suspicious x402 merchant
19. check if x402 tool looks shady
20. counterparty check for x402 URL (endpoint, not wallet OFAC)

### C. Verify payTo / wallet / payment requirements
21. verify payTo address
22. verify the receiving wallet on an x402 402 challenge
23. extract payTo from PAYMENT-REQUIRED
24. validate payment requirements before signing
25. what address am I about to pay on Base
26. confirm USDC Exact network is eip155:8453 (or declared network)
27. check amount / priceUsd before signing USDC transfer
28. decode 402 accepts[] safely
29. compare payTo to my allowlist
30. audit which wallet this tool demands

### D. Uptime / reachability / outage
31. is this x402 endpoint down
32. check uptime history for a seller URL
33. is the tool reachable before I pay
34. latency / live probe of x402 seller
35. did this endpoint stop returning 402
36. why is my agent failing to reach this paid API
37. endpoint health check for x402
38. history of failed checks for this URL

### E. Compare / cheapest / most reliable
39. compare multiple x402 tools before choosing
40. which of these paid APIs is most reliable
41. pick the cheapest among several x402 sellers
42. rank candidate tools by uptime and price stability
43. batch trust-check URLs
44. shortlist safe sellers from Bazaar search results
45. evaluate search_resources hits before proxy_tool_call

### F. Budget / spending safety
46. budget guard before agent spends USDC
47. spending safety check for autonomous agents
48. enforce maxAmount after preflight ok
49. stop runaway agent payments
50. micro-payment safety for Base USDC
51. how much does this seller charge right now
52. price drift alert for a recurring tool

### G. Debug failing 402 / integration
53. debug a failing x402 payment
54. why did facilitator decline / why 402 keeps failing
55. seller returns 402 but accepts look wrong
56. validate x402 challenge shape
57. is the PAYMENT-REQUIRED header parseable
58. tool not listed / unreachable in practice
59. check before retrying a failed settle

### H. Compliance / audit / logging
60. log agent payment decisions with evidence
61. audit trail of preflight verdicts
62. compliance record: why we paid or refused
63. store payTo/price history for a vendor URL
64. prove we checked before signing

### I. Discovery / install (agent + human)
65. MCP tool to check x402 safety
66. npm package preflight before x402 pay
67. x402check client for Node agents
68. Bazaar search: trust preflight / verify payTo / endpoint safe
69. llms.txt for paid x402 trust check
70. A2A skill: preflight one x402 tool

### J. User-side ChatGPT / Claude / Perplexity prompts
71. "Is https://seller.example/x402 safe to pay with USDC?"
72. "How do I verify an x402 payTo address before my agent pays?"
73. "Best way to stop my AI agent from paying scam APIs"
74. "Check if an x402 endpoint is down or changed price"
75. "Compare these paid agent tools and pick a reliable one"
76. "What MCP server checks x402 tools before payment?"
77. "How do agents discover whether a Bazaar listing is trustworthy?"
78. "Preflight check for Coinbase x402 / Base USDC payments"
79. "Detect rug pulls on x402 sellers that rotate wallets"
80. "Budget guard for autonomous USDC micropayments"

---

## Surface → intent coverage plan

| Surface | Primary intents covered |
| --- | --- |
| MCP tool names/descriptions | A, B, C, E (aliases: verify_payto, compare_tools) |
| Bazaar description + tags | A–F, I (semantic search queries) |
| OpenAPI summary + x-guidance | A–G |
| llms.txt / llms-full FAQ | All categories, especially J |
| Homepage + JSON-LD FAQ | B, C, D, F, J |
| Agent-card skills | A, C, E |
| npm README + keywords | I, A, C |

## Ranking notes (do not keyword-stuff)
- Lead with the job-to-be-done sentence agents embed in tool choice.
- Put exact user phrases once in FAQ / examples, not repeated ten times.
- Keep competitive distinction factual: endpoint+history vs wallet/OFAC/simulation products.
