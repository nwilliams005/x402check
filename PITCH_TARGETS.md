# x402check pitch & integration targets

Research date: **2026-11-01** (America/Chicago).  
Goal: maximize **paying** check volume ($0.01/check) and $5 watch subscriptions.  
Rule: every URL below was HTTP-checked from this box on 2026-11-01/02; unverified leads are omitted. Do not invent contacts.

Ecosystem context (independent census, verified live): [Tanod — State of the Agent Economy, Oct 2026](https://tanod.dev/reports/agent-economy-2026-10.html) — ~35k CDP Bazaar resources, ~16k PayAI discovery listings, ~2.8k Circle discovery URLs, ~40k Official MCP Registry servers. Most listed x402 endpoints see almost no real multi-payer usage; a pre-payment safety check is an empty niche.

---

## Top 10 (ranked by likely paying-customer impact)

### 1. Coinbase AgentKit — **P0 (already in flight)**
- **Why:** Agents that already have wallets and x402 pay loops. One merged hook means every AgentKit agent can call x402check before spending USDC. Nicklaus already opened the PR.
- **Path:** Keep [PR #1613](https://github.com/coinbase/agentkit/pull/1613) aligned with shared `beforePayment` (#1454 / #1402). Respond to review in real time. After merge, ship a short docs example in AgentKit examples and tweet the merge.
- **Contact / repo:** https://github.com/coinbase/agentkit · PR https://github.com/coinbase/agentkit/pull/1613  
- **Verified:** `200` on repo + PR.

### 2. Coinbase x402 client stack (`@x402/*`, CDP Bazaar) — **P0**
- **Why:** Default path for agents that discover and pay via CDP. Bazaar MCP already does `search_resources` + `proxy_tool_call` with auto-pay; inserting a check before pay protects the whole funnel and drives recurring $0.01 calls.
- **Path:** (a) Open a docs/example PR on [coinbase/x402](https://github.com/coinbase/x402) showing “preflight → then `@x402/fetch` / `@x402/mcp` pay”. (b) Pitch CDP for a Bazaar trust/quality signal or “recommended preflight” link on resource detail (partnership email via CDP support / Discord once Nicklaus approves outreach text). (c) Keep our own Bazaar listing fresh (settle with discovery extension).
- **Contact / repo:** https://github.com/coinbase/x402 · Bazaar docs https://docs.cdp.coinbase.com/x402/bazaar · get-discovered https://docs.cdp.coinbase.com/x402/seller/get-discovered · MCP transport spec https://github.com/coinbase/x402/blob/main/specs/transports-v2/mcp.md · package metadata https://registry.npmjs.org/@x402/mcp  
- **Verified:** `200` on all of the above (npmjs.com HTML pages often `403` bots; registry.npmjs.org is the verified source).

### 3. Circle Agent Marketplace / Circle x402 discovery — **P1**
- **Why:** Curated, higher-priced x402 feed (~2.8k URLs in Tanod census). Agents browsing Circle’s marketplace are exactly the buyers who should check `payTo` / price before spending.
- **Path:** Submit/list x402check as a marketplace service if the catalog accepts third-party tools; otherwise partnership email asking to recommend a preflight step in their agent skill docs. MCP discovery skill is public.
- **Contact / repo:** Marketplace docs https://developers.circle.com/agent-stack/agent-marketplace · Agent skill https://agents.circle.com/services/SKILL.md · Discovery API https://api.circle.com/v2/x402/discovery/resources  
- **Verified:** `200` on all three.

### 4. PayAI x402 Facilitator — **P1**
- **Why:** Second-largest open discovery catalog. Merchants and agents on PayAI’s multi-chain facilitator still need payTo/price drift detection; watch is a natural upsell.
- **Path:** Partnership note: “recommend x402check before settle” in their seller docs, or deep-link from discovery UI. Optionally settle once through PayAI so we appear in their Bazaar if/when we enable that facilitator.
- **Contact / repo:** Facilitator https://facilitator.payai.network/ · Bazaar docs https://docs.payai.network/x402/facilitators/bazaar  
- **Verified:** `200` on both.

### 5. LangChain / LangGraph — **P1**
- **Why:** Largest agent framework surface. We already ship [`x402check-langchain` on PyPI](https://pypi.org/project/x402check-langchain/) and npm. Getting into LangChain’s community integrations / docs is compounding discovery.
- **Path:** (a) PR or docs issue on [langchain-ai/langchain](https://github.com/langchain-ai/langchain) to list the tool. (b) Publish a LangGraph example that calls x402check before any paid HTTP tool. (c) Engage related packages that already pay x402 ([langchain-x402](https://pypi.org/project/langchain-x402/), [x402-bazaar](https://pypi.org/project/x402-bazaar/)) with a “compose with x402check” PR / issue.
- **Contact / repo:** https://github.com/langchain-ai/langchain · LangGraph docs https://langchain-ai.github.io/langgraph/ · our package https://pypi.org/project/x402check-langchain/ · related https://github.com/kmatthewsio/langchain-x402 · https://pypi.org/project/x402-bazaar/  
- **Verified:** `200` on all.

### 6. Vercel AI SDK + OpenAI Agents SDK — **P1**
- **Why:** We already have `x402check-ai-sdk`. AgentKit itself ships Vercel AI SDK and OpenAI Agents examples — dual path via AgentKit merge and direct package docs.
- **Path:** Docs PR / example repo showing `generateText` + x402check tool before pay. OpenAI Agents: add a tools example in a gist or PR against community examples; package already exists for TS/Python via AgentKit ecosystem.
- **Contact / repo:** Vercel AI SDK https://sdk.vercel.ai/ · OpenAI Agents (Python) https://github.com/openai/openai-agents-python · AgentKit examples live under https://github.com/coinbase/agentkit  
- **Verified:** `200` on all three.

### 7. ElizaOS — **P2**
- **Why:** Onchain social/agent runtime with plugin architecture; AgentKit historically listed Eliza as a target framework. High overlap with crypto-native agents that will hit x402 sellers.
- **Path:** Publish an Eliza plugin wrapping `https://x402check.dev` (or npm `x402check-client`), open a PR/issue on the monorepo, and demo in their Discord once Nicklaus approves outreach.
- **Contact / repo:** https://github.com/elizaOS/eliza · site https://elizaos.ai/  
- **Verified:** `200` on both.

### 8. Merit Systems x402scan — **P2**
- **Why:** The public ecosystem explorer agents and humans use to inspect sellers/origins. A “Check with x402check” button or OpenAPI “verify” deep-link turns browsers into paying API callers.
- **Path:** Finish our origin registration (account login). Then PR/issue on [Merit-Systems/x402scan](https://github.com/Merit-Systems/x402scan) proposing an outbound link or badge using our OpenAPI / preflight URL. Spec: https://www.x402scan.com/discovery/spec.md
- **Contact / repo:** https://www.x402scan.com/ · https://github.com/Merit-Systems/x402scan  
- **Verified:** `200` on site + repo.

### 9. Official MCP Registry + MCP directories (Smithery, Glama, mcp.so) — **P2**
- **Why:** ~40k MCP servers; agents that install tools from directories are natural MCP callers of `x402check-mcp` (already published). Each listing is recurring discovery, not a one-off tweet.
- **Path:** Keep Official Registry entry current (`dev.x402check/mcp`). Submit/refresh: Smithery (Streamable HTTP `https://x402check.dev/mcp`), Glama, mcp.so. Use the checklist at plugandship.
- **Contact / repo:** Registry about https://modelcontextprotocol.io/registry/about · API https://registry.modelcontextprotocol.io/ · Smithery https://smithery.ai/ · Glama https://glama.ai/ · mcp.so https://mcp.so/ · submit guide https://plugandship.dev/guides/where-to-submit-mcp-server · Docker MCP Catalog docs https://docs.docker.com/ai/mcp-catalog-and-toolkit/catalog/  
- **Verified:** `200` on all listed (Glama `/mcp` path timed out earlier; apex `https://glama.ai/` is `200`). PulseMCP returned `403` from this host — do not treat as dead, but verify in a browser before pitching.

### 10. x402-paying agent wallets / SDKs (Agenti, Access402, x402-agent, CrewAI) — **P2**
- **Why:** These projects already teach agents to pay. They are the highest-intent embed points for a mandatory or default preflight. CrewAI docs are a large builder audience; Agenti and Access402 are x402-native.
- **Path:** Open friendly issues/PRs: “optional preflight_url before pay”. Offer our MCP + LangChain + AI SDK packages. CrewAI: docs example using x402check then paid tool.
- **Contact / repo:** Agenti https://github.com/nirholas/agenti · Access402 https://access402.com/ · x402-agent https://github.com/xenarch-ai/x402-agent · CrewAI docs https://docs.crewai.com/ · x402-agent-tools https://github.com/Br0ski777/x402-agent-tools  
- **Verified:** `200` on all.

---

## Strong secondary targets (after top 10)

| Target | Why | Path | URL (verified) | Priority |
| --- | --- | --- | --- | --- |
| x402 Foundation repo | Spec + reference clients; docs PR reaches every implementer | Docs/example PR: “check before PAYMENT-SIGNATURE” | https://github.com/x402-foundation/x402 (`200`) | P2 |
| 402 Index / x402dash / x402 List | Discovery indexes humans + agents use | Keep listings accurate; request featured “security/preflight” tag where editable | https://402index.io/ · https://x402dash.com/submit/ · https://www.x402-list.com/ (all `200`) | P2 |
| Privy | AgentKit wallet provider; agents with Privy wallets will pay x402 | Partnership / docs mention of preflight before spend limits | https://www.privy.io/ (`200`) | P3 |
| ZeroDev | Smart-wallet agent examples in AgentKit | Same: docs + example before pay | https://zerodev.app/ (`200`) | P3 |
| XMTP | Agent messaging + AgentKit chatbot examples | Community post / example once AgentKit merges | https://xmtp.org/ (`200`) | P3 |
| Pydantic AI / Strands / AutoGen | AgentKit Python framework extensions | Package wrapper + example after AgentKit merge | https://ai.pydantic.dev/ · https://strandsagents.com/ · https://github.com/microsoft/autogen (all `200`) | P3 |
| High-traffic x402 sellers (e.g. blockrun.ai) | Sell them **watch** ($5) + bulk preflight for their own status pages | Outbound email with live `/stats` proof — only after Nicklaus approves copy | https://blockrun.ai/ (`200`) | P3 |
| Recall Kitchen | Existing MCP/x402 seller; we already engaged via PR | Keep PR #129 useful; ask them to call x402check from their agent demos | https://recallkitchen.com/docs/ (`200`) | P3 |
| Chainlink (agents.chain.link appeared in Tanod top hosts) | High call volume host in census | Research correct public contact; `agents.chain.link` returned `404` from this box — do not pitch that URL until a live page is found | https://chain.link/ (`200`); agents subdomain **not verified** | hold |

---

## Pitch angles that convert (for people + agents)

1. **Before PAYMENT-SIGNATURE** — “Is this API a scam / did payTo change / is the price what I was quoted?”
2. **AgentKit / `@x402/mcp` default** — one line in the pay loop; we bill $0.01 only when they actually check.
3. **Watch for operators** — $5/30d daily re-check + webhook/email when payTo, price, network, or availability drifts.
4. **Honest social proof** — only cite live https://x402check.dev/stats (never invent volume).

---

## Outreach rules (Nicklaus)

- No emails, Discord DMs, tweets, or PR comments that pitch partnerships **without his explicit approval** of the text and recipient.
- AgentKit PR replies that are technical review responses stay covered by existing standing permission.
- Prefer open PRs/issues with working code over cold partnership decks.

---

## Suggested next 7 days (execution order)

1. Land / babysit AgentKit #1613 (P0).  
2. Draft (do not send) CDP + Circle + PayAI partnership notes for Nicklaus.  
3. Open one docs/example PR on `coinbase/x402` or Foundation repo.  
4. Refresh Smithery / Glama / mcp.so listings.  
5. Finish x402scan login + origin registration, then open the “Check” deep-link issue.  
6. One LangChain community integration PR using the published PyPI package.  
7. Turn on Resend email for watch (see `RESEND_SETUP.md`) so $5 watch converts non-webhook buyers.
