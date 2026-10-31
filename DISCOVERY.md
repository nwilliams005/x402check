# x402check discovery — research, audit, fixes (Oct 31, 2026)

Do not fabricate. Deploy / account creation / directory registration need Nicklaus approval.
IndexNow / sitemap pings run **only after** production deploy.

## Live audit (pre-fix, against https://x402check.dev)

| Channel | Live before | Gap |
| --- | --- | --- |
| CDP Bazaar | Listed after paid settle | Enrich tags/iconUrl/descriptions |
| `/.well-known/x402` | Present | Non-canonical shape; resources should be URL strings + `version: 1` |
| OpenAPI `/openapi.json` | Present + x-guidance / x-payment-info / 402 | Contact was `ops@example.com`; add discovery paths + PaymentRequired schema |
| `llms.txt` | Present | Add `llms-full.txt`, keyword FAQ, markdown twins |
| A2A agent-card | Present | Stronger skills/examples/iconUrl |
| MCP | `/mcp` + `/mcp.json` + legacy card | Missing SEP-2127 `/mcp/server-card` + `/.well-known/ai-catalog.json` |
| `robots.txt` | `Disallow: /` | Blocked crawlers — must Allow + Sitemap + AI bots |
| `sitemap.xml` | Missing | Add |
| SEO (OG / canonical / JSON-LD) | Thin / absent | Add WebAPI + SoftwareApplication + FAQPage |
| 402 body | Header only | Enrich JSON with howToPay steps |
| Icon | Missing | `/assets/icon.svg` + Bazaar `iconUrl` |
| IndexNow | Missing | Key file `/{key}.txt` (ping **after** deploy) |

## Research sources (2026)

### x402 / Bazaar
- Bazaar extension: https://github.com/x402-foundation/x402/blob/main/specs/extensions/bazaar.md
- Get discovered: https://docs.cdp.coinbase.com/x402/seller/get-discovered
- Validate: https://docs.cdp.coinbase.com/x402/validate-endpoint
- Rules: `declareDiscoveryExtension` with input + inputSchema + output.example; `serviceName` ≤32 ASCII; ≤5 tags; optional `iconUrl`; **never** `discoverable: true`. Listing = successful **settle** with resource set (verify alone does not index).

### x402scan
- Spec: https://www.x402scan.com/discovery/spec.md
- Merit DISCOVERY: https://github.com/Merit-Systems/x402scan/blob/main/docs/DISCOVERY.md
- OpenAPI-first at `/openapi.json` (`info.x-guidance`, paid ops need `x-payment-info` + `responses.402`, free ops `security: []`).
- `/.well-known/x402` is compatibility: `version: 1`, `resources` as absolute URL strings.
- Register origin at x402scan resources/register (account).

### Other x402 indexes
- Survey: https://youraitools.co/guides/where-to-list-x402-api
- 402 Index: POST https://402index.io/api/v1/register
- x402dash: https://x402dash.com/submit/ · API https://api.x402dash.com/v1/register
- x402 List: https://www.x402-list.com/

### llms.txt / OpenAPI-for-agents / A2A
- llms.txt v2: https://llmstxt.org/
- Informal `llms-full.txt` convention for concatenated FAQ + API.
- OpenAPI→tools: stable `operationId`, when-to-call descriptions: https://agentpatterns.ai/standards/openapi-agent-tool-spec/
- A2A Agent Card: https://a2a-protocol.org/latest/topics/agent-discovery/ → `/.well-known/agent-card.json` (+ compat `agent.json`).

### MCP
- Official Registry: https://modelcontextprotocol.io/registry/about · auth https://modelcontextprotocol.io/registry/authentication
- DNS namespace: reverse-DNS `dev.x402check/mcp`; apex TXT `v=MCPv1; k=ed25519; p=PUBLIC_KEY` on `x402check.dev` (we own the domain on Cloudflare → DNS auth is possible).
- SEP-2127 Server Card: `/mcp/server-card` with `application/mcp-server-card+json`; domain AI Catalog at `/.well-known/ai-catalog.json`.
- Smithery: https://smithery.ai/docs/build/publish (Streamable HTTP; legacy `/.well-known/mcp/server-card.json` if auth blocks scan).
- Directory checklist: https://plugandship.dev/guides/where-to-submit-mcp-server (Glama, mcp.so, …).

### Classic search + AI crawlers
- `robots.txt`: Allow `/`, list Sitemap, explicit Allow for GPTBot / ClaudeBot / PerplexityBot / Google-Extended / Bingbot / etc.
- `sitemap.xml` covering landing, docs, llms, OpenAPI, MCP/A2A cards.
- schema.org JSON-LD: `WebAPI` + `SoftwareApplication` + `FAQPage` answering “is this x402 endpoint safe?” / “verify payTo”.
- Meta + Open Graph + canonical + markdown `rel=alternate`.
- IndexNow: host `https://x402check.dev/{key}.txt` then POST changed URLs (Bing/Yandex/etc.) — **after deploy only**.

## Fixes applied in this repo (not yet deployed)

- Rewrote `src/discovery.ts`: canonical x402 well-known, SEP-2127 + legacy MCP cards, AI Catalog, Allow-all robots, sitemap, enriched `paymentRequiredBody`, IndexNow key constant.
- Rewrote `src/openapi.ts`: contact `hustlelab@mail.grokbot.com`, discovery paths with `security: []`, PaymentRequired schema, `llms-full.txt`, markdown twins, keyword-rich guidance.
- Rewrote `src/pages.ts`: OG/Twitter, canonical, JSON-LD FAQ, keyword copy.
- Rewrote `src/index.ts`: routes for `/llms-full.txt`, `/sitemap.xml`, `/index.md`, `/docs.md`, `/mcp/server-card`, `/.well-known/ai-catalog.json`, `/{indexnow-key}.txt`, `/assets/icon.svg`; Bazaar `iconUrl` + richer tags; 402 JSON body enrichment; CORS/cache headers on discovery docs.
- `public/assets/icon.svg` + `public/indexnow-key.txt` (reference copies; Worker serves these paths itself).
- Expanded `scripts/test-local.mjs` for all new discovery surfaces.

## External to-do (needs Nicklaus / accounts) — exact URLs

Do **not** register or publish without his approval. DNS TXT for MCP Registry is reversible but still needs his OK before writing DNS.

| Step | URL | What’s needed |
| --- | --- | --- |
| Deploy this commit | (see DEPLOY.md) | Nicklaus says “deploy”; then run the deploy command below |
| IndexNow ping (after deploy) | https://api.indexnow.org/indexnow | No account. POST key + URL list. **Flagged for after deploy.** |
| Google sitemap ping (after deploy) | https://www.google.com/ping?sitemap=https://x402check.dev/sitemap.xml | No account. **After deploy.** |
| Bing Webmaster | https://www.bing.com/webmasters | Microsoft account; add `x402check.dev`; DNS or IndexNow verify |
| Google Search Console | https://search.google.com/search-console | Google account; DNS TXT on Cloudflare for `x402check.dev`; submit sitemap |
| x402scan register | https://www.x402scan.com/ (resources/register) | Account + origin `https://x402check.dev` (OpenAPI must stay valid) |
| 402 Index | https://402index.io/ · POST `/api/v1/register` | Account or API body `{url,name,protocol}` |
| x402dash | https://x402dash.com/submit/ | Form / POST https://api.x402dash.com/v1/register |
| x402 List | https://www.x402-list.com/ | Free submit from own domain |
| MCP Registry | https://modelcontextprotocol.io/registry/about | `mcp-publisher` installed; needs apex TXT on `x402check.dev` (`v=MCPv1; k=ed25519; p=…` — key at /workspace/.mcp-registry). CLOUDFLARE_API_TOKEN lacks DNS scope (403). Publish after npm package is live. |
| Smithery | https://smithery.ai/docs/build/publish | Account; Streamable HTTP `https://x402check.dev/mcp` |
| Glama | https://glama.ai/mcp | Account / GitHub; submit server |
| mcp.so | https://mcp.so/ | Account; submit listing |
| npm packages | https://www.npmjs.com/ | Account `x402check-dev` ready; publish blocked until granular token with bypass-2fa (classic login token cannot publish). Packages prepared as unscoped `x402check-client` / `x402check-mcp` (@x402check/* taken by unrelated x402check.xyz). |

## After-deploy checklist (account-free — run then)

```bash
# IndexNow (key already served at /32f90a760723b12a25ff3e310dbfd64a.txt after deploy)
curl -sS -X POST 'https://api.indexnow.org/indexnow' \
  -H 'content-type: application/json' \
  -d '{"host":"x402check.dev","key":"32f90a760723b12a25ff3e310dbfd64a","keyLocation":"https://x402check.dev/32f90a760723b12a25ff3e310dbfd64a.txt","urlList":["https://x402check.dev/","https://x402check.dev/docs","https://x402check.dev/llms.txt","https://x402check.dev/llms-full.txt","https://x402check.dev/openapi.json","https://x402check.dev/mcp/server-card","https://x402check.dev/.well-known/agent-card.json","https://x402check.dev/.well-known/ai-catalog.json","https://x402check.dev/sitemap.xml"]}'

# Google sitemap ping
curl -sS 'https://www.google.com/ping?sitemap=https%3A%2F%2Fx402check.dev%2Fsitemap.xml'
```

## Deploy command (only after Nicklaus approval)

```bash
cd /workspace/x402-preflight && WRANGLER_CACHE_DIR=/tmp/wcache npx wrangler deploy --config wrangler.toml
```

Secrets `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` must already be set on the Worker (do not re-print).
