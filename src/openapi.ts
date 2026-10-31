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
      version: "0.2.0",
      summary: "Paid per-tool trust check before an agent pays an x402 endpoint",
      description:
        "Call BEFORE any x402 payment to a third-party tool. Every check is paid " +
        `($${unit}/tool). GET checks one URL; POST batches up to 25 (N×unit in one Exact settlement). ` +
        "Response: compact verdict (ok|caution|avoid) + that tool's history only (checks, uptime, payTo/price changes). " +
        "If verdict=avoid do not pay. Cached history targets <300ms; live probe when stale.",
      contact: { name: "operator", email: "ops@example.com" },
      "x-guidance":
        "Always call GET /preflight?url=SELLER_URL (or POST batch) before PAYMENT-SIGNATURE to that seller. " +
        "Deny payment when verdict=avoid; escalate when caution; still enforce your maxAmount when ok. " +
        `Unit price $${unit} USDC Exact. Discovery: ${origin}/llms.txt ${origin}/.well-known/agent-card.json ${origin}/mcp.json`,
      "x-x402": {
        scheme: "exact",
        pricePerToolUsd: unit,
        networks: ["eip155:8453", "eip155:84532"],
        asset: "USDC",
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
            "or when payTo/price may have drifted. Returns only that tool's verdict + history. " +
            "Do not pay the target if verdict is avoid. Probe is a read-only GET to the target (we never pay it).",
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
              description: "Payment Required — x402 Exact; PAYMENT-REQUIRED header present",
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
      "/mcp.json": {
        get: {
          operationId: "getMcpDescriptor",
          tags: ["discovery"],
          summary: "MCP server wrapper description",
          security: [],
          responses: { "200": { description: "MCP descriptor JSON" } },
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
    version: "0.2.0",
    description:
      "Before any x402 payment: trust-check the seller URL. Returns ok|caution|avoid + that tool's history. Paid per tool.",
    transport: { type: "streamable-http", url: `${origin}/mcp` },
    serverCard: `${origin}/.well-known/mcp/server-card.json`,
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
          "Trust-check one x402 seller URL before paying it. Call when about to settle. Deny pay if verdict=avoid.",
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
      "Use npm @scope/x402check-client to auto-call preflight before any x402 pay.",
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

> Paid per-tool trust check before an AI agent pays an x402 endpoint. No free checks. Unit $${pricePerTool} USDC Exact. Batch = N × unit in one payment.

Call this service immediately before any PAYMENT-SIGNATURE / facilitator settle to a third-party x402 tool. If verdict=avoid, do not pay. If caution, escalate. If ok, still enforce your maxAmount. Probes are read-only GET; we never pay the target.

Exact settles one amount per HTTP request. Batch uses DynamicPrice = len(urls)*unit.

## Docs

- [OpenAPI](${origin}/openapi.json): Machine contract with x-payment-info and schemas
- [Human docs](${origin}/docs): Usage for operators
- [A2A Agent Card](${origin}/.well-known/agent-card.json): Agent2Agent discovery card
- [x402 well-known](${origin}/.well-known/x402): x402scan compatibility discovery
- [MCP descriptor](${origin}/mcp.json): Tool list + pricing for MCP hosts
- [MCP server card](${origin}/.well-known/mcp/server-card.json): Smithery scan card
- [MCP endpoint](${origin}/mcp): Streamable-HTTP JSON-RPC (tools/list free; tools/call paid via x402)

## Endpoints

- [GET /preflight](${origin}/preflight): Query url=https://seller… → ToolCheck (402 if unpaid)
- [POST /preflight](${origin}/preflight): Body {"urls":[…]} → BatchResult (charged per URL)

## Response fields (stable)

url, verdict (ok|caution|avoid), checkedAt, live, cacheAgeMs, status, latencyMs, is402, priceUsd, payTo, network, reasonCodes[], history{checks,uptimePct,payToChanges,priceChanges,recent}

## Optional

- [Client wrapper draft](${origin}/docs): packages/x402check-client — wrap pay() with preflight
- [Home](${origin}/): Landing
`;
}
