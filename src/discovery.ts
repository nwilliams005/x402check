/**
 * Agent-discovery documents (A2A agent card, x402scan well-known, MCP server card).
 * Sources: a2a-protocol.org agent-discovery; x402scan discovery/spec.md; Smithery server-card.
 */

export function agentCard(origin: string, pricePerTool: number) {
  return {
    protocolVersion: "0.3.0",
    name: "x402check",
    description:
      "Call before paying any x402 tool. Returns ok|caution|avoid plus that tool's history (uptime, payTo/price drift). Paid per URL checked.",
    url: `${origin}/preflight`,
    preferredTransport: "HTTP+JSON",
    version: "0.2.0",
    documentationUrl: `${origin}/docs`,
    provider: {
      organization: "x402check",
      url: origin,
    },
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "preflight_one",
        name: "Preflight one x402 tool",
        description:
          "Trust-check one absolute https x402 seller URL before you pay it. Use when about to settle payment to an unknown or changed endpoint.",
        tags: ["x402", "trust", "preflight", "safety"],
        examples: [
          `GET ${origin}/preflight?url=https://seller.example/api (pay $${pricePerTool} first)`,
        ],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        id: "preflight_batch",
        name: "Preflight batch of x402 tools",
        description:
          "Trust-check up to 25 seller URLs in one request. Charged per URL (N × unit) in a single Exact settlement.",
        tags: ["x402", "trust", "batch"],
        examples: [
          `POST ${origin}/preflight {"urls":["https://a.example","https://b.example"]}`,
        ],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
    ],
    securitySchemes: {
      x402: {
        type: "apiKey",
        in: "header",
        name: "PAYMENT-SIGNATURE",
        description: "x402 Exact payment proof after 402 PAYMENT-REQUIRED challenge",
      },
    },
    security: [{ x402: [] }],
  };
}

/** Compatibility alias some A2A clients still probe. */
export function agentJson(origin: string, pricePerTool: number) {
  return agentCard(origin, pricePerTool);
}

/**
 * x402scan prefers OpenAPI; /.well-known/x402 is compatibility fallback.
 * https://www.x402scan.com/discovery/spec.md
 */
export function x402WellKnown(origin: string, pricePerTool: number) {
  return {
    version: "2",
    name: "x402check",
    description:
      "Paid per-tool trust check before an agent pays an x402 endpoint. Verdict + history only.",
    openapi: `${origin}/openapi.json`,
    llms: `${origin}/llms.txt`,
    resources: [
      {
        method: "GET",
        path: "/preflight",
        description: "Check one seller URL (query url=). Unit price per tool.",
        priceUsd: pricePerTool,
        pricing: "dynamic",
      },
      {
        method: "POST",
        path: "/preflight",
        description: "Batch check urls[]; charge = len(urls) × unit in one Exact payment.",
        priceUsdPerItem: pricePerTool,
        pricing: "dynamic",
        maxItems: 25,
      },
    ],
  };
}

/** Smithery scan fallback when auth blocks live MCP probe. */
export function mcpServerCard(origin: string, pricePerTool: number) {
  return {
    name: "x402check",
    description:
      "Trust-check x402 seller URLs before paying. Paid per tool via x402 Exact.",
    version: "0.2.0",
    url: `${origin}/mcp`,
    transport: "streamable-http",
    tools: [
      {
        name: "preflight_check",
        description:
          "Before paying any x402 endpoint: call this with the absolute https URL. Returns verdict ok|caution|avoid plus that tool's history (checks, uptimePct, payToChanges, priceChanges). Do not pay if verdict=avoid.",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: {
              type: "string",
              description: "Absolute https URL of the x402 seller to probe",
            },
            fresh: {
              type: "boolean",
              description: "Force live probe; ignore cache",
            },
          },
        },
        annotations: {
          title: "x402 preflight check",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
      },
      {
        name: "preflight_batch",
        description:
          "Trust-check multiple x402 seller URLs. Charged per URL. Prefer when comparing alternatives before choosing which to pay.",
        inputSchema: {
          type: "object",
          required: ["urls"],
          properties: {
            urls: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 25,
            },
            fresh: { type: "boolean" },
          },
        },
        annotations: {
          title: "x402 preflight batch",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
      },
    ],
    pricing: {
      model: "x402-exact",
      pricePerToolUsd: pricePerTool,
      note: "MCP tools/call requires PAYMENT-SIGNATURE for paid HTTP routes, or use the HTTP client wrapper.",
    },
  };
}

export function robotsTxt(origin: string): string {
  return `User-agent: *
Allow: /llms.txt
Allow: /openapi.json
Allow: /mcp.json
Allow: /.well-known/
Allow: /docs
Disallow: /

# Agent discovery
# Sitemap-equivalent: ${origin}/llms.txt
`;
}
