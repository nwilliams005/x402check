/**
 * OpenAPI + llms.txt + MCP descriptor tuned for agent discovery.
 * x402scan: /openapi.json with x-guidance, x-payment-info, responses.402
 *   https://www.x402scan.com/discovery/spec.md
 * llms.txt v2: https://llmstxt.org/
 * OpenAPI→tool: stable operationId → tool name
 */

export function openApiSpec(origin: string, pricePerTool: number) {
  const unit = Number(pricePerTool.toFixed(6));
  const amount = unit.toFixed(6);
  const paymentInfoFixed = {
    price: { mode: "fixed" as const, currency: "USD", amount },
    protocols: [{ x402: { scheme: "exact", network: "eip155:8453", asset: "USDC" } }],
  };
  const paymentInfoDynamic = {
    price: {
      mode: "dynamic" as const,
      currency: "USD",
      min: amount,
      max: (unit * 25).toFixed(6),
    },
    protocols: [{ x402: { scheme: "exact", network: "eip155:8453", asset: "USDC" } }],
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "x402check",
      version: "0.2.1",
      summary: "Paid per-tool trust check before an agent pays an x402 endpoint",
      description:
        "Call BEFORE any x402 payment to a third-party tool. Every check is paid " +
        `($${unit}/tool). GET checks one URL; POST batches up to 25 (N×unit in one Exact settlement). ` +
        "Response: compact verdict (ok|caution|avoid) + that tool's history only (checks, uptime, payTo/price changes). " +
        "Answers agent questions: is this x402 endpoint safe? verify payTo; detect price drift; check uptime before settle. " +
        "If verdict=avoid do not pay. Cached history targets <300ms; live probe when stale.",
      contact: {
        name: "x402check",
        email: "hustlelab@mail.grokbot.com",
        url: origin,
      },
      "x-guidance":
        "Always call GET /preflight?url=SELLER_URL (or POST batch) before PAYMENT-SIGNATURE to that seller. " +
        "Deny payment when verdict=avoid; escalate when caution; still enforce your maxAmount when ok. " +
        `Unit price $${unit} USDC Exact on Base (eip155:8453). ` +
        "Use when: is this x402 endpoint safe, verify payTo, check price history, compare sellers before paying. " +
        `Discovery: ${origin}/llms.txt ${origin}/.well-known/agent-card.json ${origin}/.well-known/ai-catalog.json ${origin}/mcp/server-card ${origin}/openapi.json`,
      "x-x402": {
        scheme: "exact",
        pricePerToolUsd: unit,
        networks: ["eip155:8453", "eip155:84532"],
        asset: "USDC",
      },
      "x-discovery": {
        ownershipProofs: [],
        wellKnown: `${origin}/.well-known/x402`,
        agentCard: `${origin}/.well-known/agent-card.json`,
        aiCatalog: `${origin}/.well-known/ai-catalog.json`,
        mcpServerCard: `${origin}/mcp/server-card`,
      },
    },
    servers: [{ url: origin, description: "This deployment" }],
    tags: [
      { name: "preflight", description: "Paid trust checks" },
      { name: "discovery", description: "Free agent discovery documents" },
    ],
    paths: {
      "/preflight": {
        get: {
          operationId: "preflightCheck",
          tags: ["preflight"],
          summary: "Trust-check one x402 seller URL before paying it",
          description:
            "WHEN TO USE: immediately before settling payment to any x402 tool you have not verified this session, " +
            "or when payTo/price may have drifted. Also when asking 'is this x402 endpoint safe' or 'verify payTo'. " +
            "Returns only that tool's verdict + history. Do not pay the target if verdict is avoid. " +
            "Probe is a read-only GET to the target (we never pay it).",
          security: [{ x402Payment: [] }],
          parameters: [
            {
              name: "url",
              in: "query",
              required: true,
              schema: { type: "string", format: "uri" },
              description: "Absolute https URL of the x402 seller endpoint to probe",
              example: "https://www.api-xpay.com/x402/ping",
            },
            {
              name: "fresh",
              in: "query",
              required: false,
              schema: { type: "boolean", default: false },
              description: "If true, force a live probe and ignore cache",
            },
          ],
          "x-payment-info": paymentInfoFixed,
          responses: {
            "200": {
              description: "Compact ToolCheck for the requested URL only",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ToolCheck" },
                  example: {
                    url: "https://www.api-xpay.com/x402/ping",
                    verdict: "ok",
                    checkedAt: "2026-10-31T17:00:00.000Z",
                    live: true,
                    is402: true,
                    priceUsd: 0.005,
                    payTo: "0x589a2314a2E05F45e40C4823Da3Ba58D421dB3d8",
                    reasonCodes: ["reachable", "http_402", "payto_stable"],
                    history: { checks: 3, uptimePct: 100, payToChanges: [], priceChanges: [] },
                  },
                },
              },
            },
            "400": {
              description: "missing_url | blocked host",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "402": {
              description:
                "Payment Required — x402 Exact. PAYMENT-REQUIRED header is authoritative; JSON body explains how to pay.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PaymentRequired" },
                },
              },
            },
          },
        },
        post: {
          operationId: "preflightBatch",
          tags: ["preflight"],
          summary: "Batch trust-check; charged per URL",
          description:
            "WHEN TO USE: compare multiple candidate x402 tools before choosing which to pay. " +
            `Charge = len(urls) × $${unit} in ONE Exact settlement (not N separate txs). Max 25.`,
          security: [{ x402Payment: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["urls"],
                  properties: {
                    urls: {
                      type: "array",
                      minItems: 1,
                      maxItems: 25,
                      items: { type: "string", format: "uri" },
                      description: "Absolute https seller URLs",
                    },
                    fresh: { type: "boolean" },
                  },
                },
                example: {
                  urls: [
                    "https://www.api-xpay.com/x402/ping",
                    "https://blockrun.ai/api/v1/chat/completions",
                  ],
                },
              },
            },
          },
          "x-payment-info": paymentInfoDynamic,
          responses: {
            "200": {
              description: "BatchResult",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/BatchResult" },
                },
              },
            },
            "400": { description: "missing_urls | batch_too_large | invalid_json" },
            "402": { description: "Payment Required — price = len(urls) × unit" },
          },
        },
      },
      "/openapi.json": {
        get: {
          operationId: "getOpenApi",
          tags: ["discovery"],
          summary: "This OpenAPI document",
          security: [],
          responses: { "200": { description: "OpenAPI 3.1" } },
        },
      },
      "/llms.txt": {
        get: {
          operationId: "getLlmsTxt",
          tags: ["discovery"],
          summary: "LLM-oriented service card (llms.txt)",
          security: [],
          responses: { "200": { description: "text/plain markdown" } },
        },
      },
      "/llms-full.txt": {
        get: {
          operationId: "getLlmsFullTxt",
          tags: ["discovery"],
          summary: "Full concatenated LLM docs (llms-full.txt convention)",
          security: [],
          responses: { "200": { description: "text/plain markdown" } },
        },
      },
      "/mcp.json": {
        get: {
          operationId: "getMcpDescriptor",
          tags: ["discovery"],
          summary: "MCP server wrapper description",
          security: [],
          responses: { "200": { description: "MCP descriptor JSON" } },
        },
      },
      "/mcp/server-card": {
        get: {
          operationId: "getMcpServerCard",
          tags: ["discovery"],
          summary: "SEP-2127 MCP Server Card",
          security: [],
          responses: { "200": { description: "application/mcp-server-card+json" } },
        },
      },
      "/.well-known/agent-card.json": {
        get: {
          operationId: "getAgentCard",
          tags: ["discovery"],
          summary: "A2A Agent Card",
          security: [],
          responses: { "200": { description: "Agent Card JSON" } },
        },
      },
      "/.well-known/x402": {
        get: {
          operationId: "getX402WellKnown",
          tags: ["discovery"],
          summary: "x402scan compatibility discovery doc",
          security: [],
          responses: { "200": { description: "x402 well-known JSON" } },
        },
      },
      "/.well-known/ai-catalog.json": {
        get: {
          operationId: "getAiCatalog",
          tags: ["discovery"],
          summary: "AI Catalog (MCP Server Card discovery)",
          security: [],
          responses: { "200": { description: "application/ai-catalog+json" } },
        },
      },
      "/sitemap.xml": {
        get: {
          operationId: "getSitemap",
          tags: ["discovery"],
          summary: "XML sitemap for search engines",
          security: [],
          responses: { "200": { description: "application/xml" } },
        },
      },
    },
    components: {
      securitySchemes: {
        x402Payment: {
          type: "apiKey",
          in: "header",
          name: "PAYMENT-SIGNATURE",
          description: "x402 Exact payment proof after receiving PAYMENT-REQUIRED",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
          },
        },
        PaymentRequired: {
          type: "object",
          properties: {
            error: { type: "string", const: "payment_required" },
            message: { type: "string" },
            howToPay: { type: "object" },
          },
        },
        ToolCheck: {
          type: "object",
          required: ["url", "verdict", "checkedAt", "live", "history", "reasonCodes"],
          properties: {
            url: { type: "string" },
            verdict: {
              type: "string",
              enum: ["ok", "caution", "avoid"],
              description: "avoid → do not pay; caution → escalate; ok → still enforce maxAmount",
            },
            checkedAt: { type: "string", format: "date-time" },
            live: { type: "boolean" },
            cacheAgeMs: { type: "integer" },
            status: { type: "integer", nullable: true },
            latencyMs: { type: "integer", nullable: true },
            is402: { type: "boolean" },
            priceUsd: { type: "number", nullable: true },
            payTo: { type: "string", nullable: true },
            network: { type: "string", nullable: true },
            reasonCodes: { type: "array", items: { type: "string" } },
            history: { $ref: "#/components/schemas/ToolHistory" },
          },
        },
        ToolHistory: {
          type: "object",
          properties: {
            checks: { type: "integer" },
            uptimePct: { type: "number", nullable: true },
            lastOkAt: { type: "string", nullable: true },
            lastFailAt: { type: "string", nullable: true },
            payToChanges: { type: "array", items: { type: "object" } },
            priceChanges: { type: "array", items: { type: "object" } },
            recent: { type: "array", items: { type: "object" } },
          },
        },
        BatchResult: {
          type: "object",
          properties: {
            results: { type: "array", items: { $ref: "#/components/schemas/ToolCheck" } },
            chargedTools: { type: "integer" },
            pricePerToolUsd: { type: "number" },
            totalUsd: { type: "number" },
            elapsedMs: { type: "integer" },
            pricingNote: { type: "string" },
          },
        },
      },
    },
  };
}

export function mcpDescriptor(origin: string, pricePerTool: number) {
  return {
    name: "x402check",
    version: "0.2.1",
    description:
      "Before any x402 payment: trust-check the seller URL. Returns ok|caution|avoid + that tool's history. Paid per tool. Use for is-this-x402-endpoint-safe and verify-payTo.",
    transport: { type: "streamable-http", url: `${origin}/mcp` },
    serverCard: `${origin}/mcp/server-card`,
    legacyServerCard: `${origin}/.well-known/mcp/server-card.json`,
    aiCatalog: `${origin}/.well-known/ai-catalog.json`,
    pricing: {
      model: "x402-exact",
      pricePerToolUsd: pricePerTool,
      batch: "POST /preflight {urls[]} → one payment of N×unit",
      limitation:
        "Exact scheme = one settlement per HTTP request; batch is summed DynamicPrice, not N separate txs.",
    },
    tools: [
      {
        name: "preflight_check",
        description:
          "Trust-check one x402 seller URL before paying it. Call when about to settle, or when asking is this x402 endpoint safe / verify payTo. Deny pay if verdict=avoid.",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", description: "Absolute https x402 endpoint" },
            fresh: { type: "boolean" },
          },
        },
        annotations: {
          title: "x402 preflight check",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
        endpoint: { method: "GET", path: "/preflight", query: ["url", "fresh"] },
      },
      {
        name: "preflight_batch",
        description: "Trust-check multiple seller URLs; charged per URL. Use to compare candidates.",
        inputSchema: {
          type: "object",
          required: ["urls"],
          properties: {
            urls: { type: "array", items: { type: "string" }, maxItems: 25 },
            fresh: { type: "boolean" },
          },
        },
        annotations: {
          title: "x402 preflight batch",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
        endpoint: { method: "POST", path: "/preflight" },
      },
    ],
    adoptionHints: [
      "Use npm x402check-client to auto-call preflight before any x402 pay.",
      "Default-on in agent runtimes with PREFLIGHT_URL + kill-switch env.",
      "List on CDP Bazaar via successful settle + declareDiscoveryExtension (no discoverable:true).",
      "Register origin on x402scan; submit to 402 Index / x402dash / x402-trust.",
      "Publish MCP to official registry + Smithery/Glama/mcp.so after public HTTPS deploy.",
      "Keep p95 <300ms via KV cache so agents never skip for latency.",
      "Stable JSON field names; clear error codes (missing_url, batch_too_large).",
    ],
  };
}

export function llmsTxt(origin: string, pricePerTool: number): string {
  return `# x402check

> Paid per-tool trust check before an AI agent pays an x402 endpoint. No free checks. Unit $${pricePerTool} USDC Exact on Base (eip155:8453). Batch = N × unit in one payment. Answers: is this x402 endpoint safe? verify payTo; detect price drift; check uptime history.

Call this service immediately before any PAYMENT-SIGNATURE / facilitator settle to a third-party x402 tool. If verdict=avoid, do not pay. If caution, escalate. If ok, still enforce your maxAmount. Probes are read-only GET; we never pay the target.

Exact settles one amount per HTTP request. Batch uses DynamicPrice = len(urls)*unit. Cache-fresh responses target <300ms so agents do not skip for latency.

## Docs

- [OpenAPI](${origin}/openapi.json): Machine contract with x-payment-info, schemas, x-guidance
- [Full LLM docs](${origin}/llms-full.txt): Concatenated agent FAQ + API reference
- [Human docs](${origin}/docs): Usage for operators
- [Docs markdown](${origin}/docs.md): LLM-friendly docs twin
- [Home markdown](${origin}/index.md): Landing twin
- [A2A Agent Card](${origin}/.well-known/agent-card.json): Agent2Agent discovery card
- [AI Catalog](${origin}/.well-known/ai-catalog.json): Domain MCP/A2A catalog (SEP-2127)
- [x402 well-known](${origin}/.well-known/x402): x402scan compatibility discovery
- [MCP descriptor](${origin}/mcp.json): Tool list + pricing for MCP hosts
- [MCP Server Card](${origin}/mcp/server-card): SEP-2127 card (streamable-http)
- [Legacy MCP card](${origin}/.well-known/mcp/server-card.json): Smithery scan fallback
- [MCP endpoint](${origin}/mcp): Streamable-HTTP JSON-RPC (tools/list free; tools/call paid via x402)
- [Sitemap](${origin}/sitemap.xml): Search-engine sitemap

## Endpoints

- [GET /preflight](${origin}/preflight): Query url=https://seller… → ToolCheck (402 if unpaid). Use for is-this-x402-endpoint-safe and verify-payTo.
- [POST /preflight](${origin}/preflight): Body {"urls":[…]} → BatchResult (charged per URL)

## When to call

- Before any x402 PAYMENT-SIGNATURE to a third-party seller
- When payTo or price may have changed since last check
- When comparing multiple candidate tools before choosing which to pay
- When a human asks "is this x402 endpoint safe" or "verify this payTo address"

## Response fields (stable)

url, verdict (ok|caution|avoid), checkedAt, live, cacheAgeMs, status, latencyMs, is402, priceUsd, payTo, network, reasonCodes[], history{checks,uptimePct,payToChanges,priceChanges,recent}

## Policy

- verdict=avoid → do not pay the target
- verdict=caution → escalate / require human confirm
- verdict=ok → still enforce your maxAmount and allowlist rules

## Optional

- [Client wrapper](${origin}/docs): packages/x402check-client — wrap pay() with preflight
- [Home](${origin}/): Landing
`;
}

export function llmsFullTxt(origin: string, pricePerTool: number): string {
  return `${llmsTxt(origin, pricePerTool)}

---

# x402check full reference

## FAQ for agents

### Is this x402 endpoint safe?
Call GET ${origin}/preflight?url=SELLER_URL (pay $${pricePerTool} USDC first). Read verdict. avoid = do not pay. caution = escalate. ok = still enforce maxAmount. history.payToChanges and history.priceChanges show drift.

### How do I verify payTo?
The ToolCheck.payTo field is the address in the seller's live 402 challenge. Compare to any allowlist. history.payToChanges lists prior addresses if the seller rotated wallets.

### How do I pay x402check itself?
Unauthenticated calls return HTTP 402 with a PAYMENT-REQUIRED header (x402 v2). Amount for one tool is 2000 atomic USDC ($${pricePerTool}). Sign with ExactEvmScheme on eip155:8453 and retry with PAYMENT-SIGNATURE. See ${origin}/openapi.json x-payment-info.

### Does batch cost N times more?
Yes. POST /preflight with urls[] charges len(urls) × $${pricePerTool} in ONE Exact settlement (not N separate transactions). Max 25 URLs.

### Will this slow my agent down?
Cache-fresh responses target <300ms. Pass fresh=1 only when you need a live re-probe.

### Do you pay the target?
Never. We only issue a read-only GET to the seller URL to observe the 402 challenge metadata.

## Example curl (after you have a PAYMENT-SIGNATURE)

\`\`\`
curl -sS '${origin}/preflight?url=https%3A%2F%2Fwww.api-xpay.com%2Fx402%2Fping' \\
  -H 'PAYMENT-SIGNATURE: <base64>'
\`\`\`

## Example batch

\`\`\`
curl -sS -X POST '${origin}/preflight' \\
  -H 'content-type: application/json' \\
  -H 'PAYMENT-SIGNATURE: <base64>' \\
  -d '{"urls":["https://a.example/x402","https://b.example/x402"]}'
\`\`\`
`;
}

export function landingMarkdown(origin: string, pricePerTool: number): string {
  return `# x402check

> Trust-check a tool before your agent pays it. $${pricePerTool} USDC Exact per tool. No free tier.

Every check is paid. You get that tool's **verdict** (ok|caution|avoid) plus its **history** (uptime, payTo changes, price changes) — nothing else. Cache-fresh responses target <300ms.

## Quick start

\`\`\`
GET ${origin}/preflight?url=https://seller.example/x402
\`\`\`

Pay $${pricePerTool} via x402 Exact on Base, then retry with PAYMENT-SIGNATURE.

## Machine-readable

- [OpenAPI](${origin}/openapi.json)
- [llms.txt](${origin}/llms.txt)
- [MCP Server Card](${origin}/mcp/server-card)
- [A2A Agent Card](${origin}/.well-known/agent-card.json)
- [AI Catalog](${origin}/.well-known/ai-catalog.json)

## Docs

See [docs.md](${origin}/docs.md) or [docs](${origin}/docs).
`;
}

export function docsMarkdown(origin: string, pricePerTool: number): string {
  return `# x402check agent docs

Paid per tool. No free checks. Unit **$${pricePerTool}** USDC Exact on Base (eip155:8453).

## Single

\`\`\`
GET ${origin}/preflight?url=https%3A%2F%2Fwww.api-xpay.com%2Fx402%2Fping
\`\`\`

## Batch (N × $${pricePerTool} in one Exact payment)

\`\`\`
POST ${origin}/preflight
{"urls":["https://a.example/x402","https://b.example/x402"]}
\`\`\`

Limitation: x402 Exact = one settlement per HTTP request. Batch uses DynamicPrice = N×unit, not N separate txs.

## Adopt by default

- Client wrapper that calls preflight before any x402 pay
- Runtime skill/middleware default-on with env kill-switch
- Policy: avoid→deny, caution→confirm, ok→still enforce maxAmount
- Bazaar listing + OpenAPI + MCP descriptor
- Keep p95 <300ms via cache so agents don't skip

## Agent questions this answers

- Is this x402 endpoint safe?
- Verify payTo before settle
- Has price drifted?
- What's the uptime history for this seller URL?

## Machine-readable

- [openapi.json](${origin}/openapi.json)
- [llms.txt](${origin}/llms.txt)
- [llms-full.txt](${origin}/llms-full.txt)
- [mcp.json](${origin}/mcp.json)
- [mcp/server-card](${origin}/mcp/server-card)
`;
}
