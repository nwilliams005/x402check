# Go-live checklist (needs Nicklaus / human) — agent must not do these

## Domain & brand
- [ ] Pick name from BRAND.md (prefer .dev/.ai available)
- [ ] Buy domain (Cloudflare Registrar prices in BRAND.md) — **human buy only**
- [ ] DNS + TLS for production Worker custom domain (not rafterlook)

## Deploy (explicit approval required)
- [ ] Set secrets: `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, confirm `PAY_TO`
- [ ] Create prod KV namespace; bind in wrangler.toml
- [ ] `ALLOW_LOCAL_BYPASS=false` on prod
- [ ] Deploy Worker (see DEPLOY.md) — **do not run without Nicklaus**
- [ ] `POST https://api.cdp.coinbase.com/platform/v2/x402/validate` against live URLs

## Bazaar / x402 indexes
- [ ] One successful **settle** via CDP facilitator with `paymentPayload.resource` (indexes Bazaar)
- [ ] Confirm EXTENSION-RESPONSES bazaar status not `rejected`
- [ ] Register origin on x402scan (resources/register)
- [ ] Submit 402 Index / Agent402 / x402dash / x402-trust / PayAPI as desired
- [ ] Optional: PayAI / Agentic.Market appear after their facilitator settles

## npm
- [ ] Choose public scope name matching brand
- [ ] Un-private + `npm publish` `@…/client` and `@…/mcp` — **human publish only**

## MCP directories
- [ ] Publish `server.json` via mcp-publisher to official MCP Registry
- [ ] Smithery: public HTTPS `/mcp` (+ server-card if needed)
- [ ] Glama: public repo + glama.json / remote URL
- [ ] mcp.so: submit repo URL

## Adoption
- [ ] Document `X402CHECK_URL` in agent runtimes; default-on client wrapper
- [ ] Optional Bazaar semantic keywords / iconUrl once domain live
