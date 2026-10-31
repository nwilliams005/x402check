# Agent discovery research (primary sources) + local application

Do not fabricate. Citations below. Local changes applied in this repo; listings/publish/deploy need Nicklaus.

## CDP Bazaar (x402 v2)

- Spec: https://github.com/x402-foundation/x402/blob/main/specs/extensions/bazaar.md
- Get discovered: https://docs.cdp.coinbase.com/x402/seller/get-discovered
- Overview: https://docs.cdp.coinbase.com/x402/bazaar
- Validate (read-only): https://docs.cdp.coinbase.com/x402/validate-endpoint

**What matters**

- Use `extensions.bazaar` via `declareDiscoveryExtension` (v2). v1 `outputSchema` is deprecated.
- Declare accurate `input` + `inputSchema` (GET query vs POST `bodyType: "json"`) and `output.example` (missing output is advisory but hurts quality ranking).
- Top-level resource fields: `description`, `mimeType`, optional `serviceName` (≤32 ASCII), `tags` (≤5), `iconUrl`.
- **Do not** set `discoverable: true` — invalid and causes rejection (CDP GH discussion on issue 2207).
- Listing = **no separate signup**: CDP Facilitator catalogs after a **successful settle** with `paymentPayload.resource` set. Verify alone does not index. Facilitator: `https://api.cdp.coinbase.com/platform/v2/x402`.
- Preflight with `POST .../v2/x402/validate` before go-live.

**Applied locally:** separate GET/POST `declareDiscoveryExtension` on `/preflight`; clear descriptions; no `discoverable` flag.

## Other x402 directories

- x402scan discovery spec: https://www.x402scan.com/discovery/spec.md (OpenAPI-first at `/openapi.json` with `info.x-guidance`, `x-payment-info`, `responses.402`; then `/.well-known/x402`; register origin at x402scan resources/register).
- Merit DISCOVERY.md: https://github.com/Merit-Systems/x402scan/blob/main/docs/DISCOVERY.md
- Directory survey (402 Index, Agent402, x402dash, x402-trust, PayAPI, PayAI/Agentic.Market settle-coupled): https://youraitools.co/guides/where-to-list-x402-api
- PipRail open indexes: https://docs.piprail.com/discovery/open-indexes/

**Applied locally:** OpenAPI with `x-guidance` + `x-payment-info` + 402; `/.well-known/x402`.

## MCP registries

- Official MCP Registry: https://modelcontextprotocol.io/registry/about (`server.json`, mcp-publisher CLI, namespace DNS/GitHub).
- Smithery publish: https://smithery.ai/docs/build/publish (Streamable HTTP; `/.well-known/mcp/server-card.json` if auth blocks scan).
- Registry/directory checklist: https://plugandship.dev/guides/where-to-submit-mcp-server (Glama, mcp.so, etc.)

**Applied locally:** `/mcp` JSON-RPC (initialize, tools/list free; tools/call documents payment), `/mcp.json`, server-card, draft `packages/x402check-mcp` with `server.json` / smithery.yaml / glama.json.

## llms.txt, OpenAPI for LLMs, A2A

- llms.txt v2: https://llmstxt.org/ (H1, blockquote summary, H2 file lists with `[name](url): notes`).
- OpenAPI→tools: stable action `operationId`, agent-oriented descriptions (when to call): https://agentpatterns.ai/standards/openapi-agent-tool-spec/
- A2A Agent Card well-known: https://github.com/a2aproject/A2A/blob/main/docs/topics/agent-discovery.md → `/.well-known/agent-card.json` (compat `agent.json`).

**Applied locally:** rewritten `/llms.txt`; `operationId`s `preflightCheck` / `preflightBatch`; agent cards; free discovery paths marked `security: []`.

## Why an LLM picks a tool

- Description says **when** to call + deny rules (avoid → don't pay).
- Low latency (KV cache &lt;300ms) so agents don't skip.
- Stable JSON field names + clear errors (`missing_url`, `batch_too_large`, `payment_required`).
- Client wrapper default-on: `packages/x402check-client` (`withPreflightPay`).

## Go-live steps

See `GO_LIVE.md` (Nicklaus / operator actions only — no deploy/publish/buy from this agent).
