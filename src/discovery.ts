/**
 * Agent-discovery documents (A2A, x402scan, MCP Server Cards, AI Catalog, SEO).
 * Sources (2026):
 * - https://www.x402scan.com/discovery/spec.md
 * - https://docs.x402.org/extensions/bazaar
 * - https://llmstxt.org/ (v2)
 * - https://a2a-protocol.org/latest/topics/agent-discovery/
 * - https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md
 * - SEP-2127 MCP Server Cards
 */

export const INDEXNOW_KEY = "32f90a760723b12a25ff3e310dbfd64a";

export function agentCard(origin: string, pricePerTool: number) {
  return {
    protocolVersion: "0.3.0",
    name: "x402check",
    description:
      "Call before paying any x402 tool. Answers: is this x402 endpoint safe? verify payTo, price drift, uptime history. Returns ok|caution|avoid + that tool's history only. Paid per URL checked.",
    url: `${origin}/preflight`,
    preferredTransport: "HTTP+JSON",
    version: "0.2.1",
    documentationUrl: `${origin}/docs`,
    iconUrl: `${origin}/assets/icon.svg`,
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
    supportedInterfaces: [
      {
        url: `${origin}/preflight`,
        protocolBinding: "https://x402.org/http+json",
        protocolVersion: "2",
      },
      {
        url: `${origin}/mcp`,
        protocolBinding: "https://modelcontextprotocol.io/streamable-http",
        protocolVersion: "2025-03-26",
      },
    ],
    skills: [
      {
        id: "preflight_one",
        name: "Preflight one x402 tool",
        description:
          "Trust-check one absolute https x402 seller URL before you pay it. Use when asking 'is this x402 endpoint safe', verifying payTo, or checking price/uptime history before PAYMENT-SIGNATURE.",
        tags: ["x402", "trust", "preflight", "safety", "payTo", "verify"],
        examples: [
          `GET ${origin}/preflight?url=https://seller.example/api (pay $${pricePerTool} first)`,
          "Is https://seller.example/x402 safe to pay?",
          "Verify payTo for this x402 tool before settle",
        ],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        id: "preflight_batch",
        name: "Preflight batch of x402 tools",
        description:
          "Trust-check up to 25 seller URLs in one request. Charged per URL (N × unit) in a single Exact settlement. Use when comparing candidates before choosing which to pay.",
        tags: ["x402", "trust", "batch", "compare"],
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
 * x402scan compatibility: version 1 + resources as absolute URL strings.
 * Extra fields kept for richer clients.
 * https://github.com/Merit-Systems/x402scan/blob/main/docs/DISCOVERY.md
 */
export function x402WellKnown(origin: string, pricePerTool: number) {
  return {
    version: 1,
    name: "x402check",
    description:
      "Paid per-tool trust check before an agent pays an x402 endpoint. Verdict + history only. Answers: is this x402 endpoint safe? verify payTo.",
    openapi: `${origin}/openapi.json`,
    llms: `${origin}/llms.txt`,
    instructions:
      `Always GET ${origin}/preflight?url=SELLER before PAYMENT-SIGNATURE to that seller. Deny when verdict=avoid. Unit $${pricePerTool} USDC Exact on Base (eip155:8453).`,
    resources: [`${origin}/preflight`],
    resourceDetails: [
      {
        method: "GET",
        path: "/preflight",
        description: "Check one seller URL (query url=). Unit price per tool.",
        priceUsd: pricePerTool,
        pricing: "fixed",
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

/**
 * Legacy Smithery-style card (tools inline) at /.well-known/mcp/server-card.json
 * Plus SEP-2127-shaped card at /mcp/server-card.
 */
export function mcpServerCardLegacy(origin: string, pricePerTool: number) {
  return {
    name: "x402check",
    description:
      "Trust-check x402 seller URLs before paying. Answers is-this-x402-endpoint-safe / verify-payTo. Paid per tool via x402 Exact.",
    version: "0.2.1",
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

/** SEP-2127 MCP Server Card (no tools list — clients use tools/list at runtime). */
export function mcpServerCardSep(origin: string, pricePerTool: number) {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: "dev.x402check/mcp",
    title: "x402check",
    description:
      `Trust-check x402 seller URLs before paying ($${pricePerTool}/tool). Returns ok|caution|avoid + that tool's history. Use before any PAYMENT-SIGNATURE.`,
    version: "0.2.1",
    icons: [{ src: `${origin}/assets/icon.svg`, mimeType: "image/svg+xml", sizes: ["any"] }],
    remotes: [
      {
        type: "streamable-http",
        url: `${origin}/mcp`,
        supportedProtocolVersions: ["2025-03-26", "2024-11-05"],
      },
    ],
  };
}

/** Domain-level AI Catalog pointing at the MCP Server Card. */
export function aiCatalog(origin: string) {
  return {
    specVersion: "1.0",
    name: "x402check",
    description:
      "AI artifacts for x402check — paid per-tool trust preflight before an agent pays an x402 endpoint.",
    entries: [
      {
        identifier: "urn:air:x402check.dev:mcp:x402check",
        type: "application/mcp-server-card+json",
        url: `${origin}/mcp/server-card`,
      },
      {
        identifier: "urn:air:x402check.dev:a2a:x402check",
        type: "application/json",
        url: `${origin}/.well-known/agent-card.json`,
      },
    ],
  };
}

export function robotsTxt(origin: string): string {
  return `# x402check — allow search + AI crawlers; discovery docs are public
User-agent: *
Allow: /
Sitemap: ${origin}/sitemap.xml

# Explicit allow for major AI / answer-engine crawlers
User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Googlebot
Allow: /
User-agent: Bingbot
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: Bytespider
Allow: /
User-agent: CCBot
Allow: /
User-agent: meta-externalagent
Allow: /
User-agent: FacebookBot
Allow: /
User-agent: cohere-ai
Allow: /

# Prefer inference use of public docs; training optional
Content-Signal: search=yes, ai-input=yes, ai-train=yes
`;
}

export function sitemapXml(origin: string, lastmod: string): string {
  const urls = [
    "/",
    "/docs",
    "/llms.txt",
    "/llms-full.txt",
    "/openapi.json",
    "/mcp.json",
    "/mcp/server-card",
    "/.well-known/agent-card.json",
    "/.well-known/agent.json",
    "/.well-known/x402",
    "/.well-known/ai-catalog.json",
    "/.well-known/mcp/server-card.json",
    "/index.md",
    "/docs.md",
  ];
  const body = urls
    .map(
      (path) => `  <url>
    <loc>${origin}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${path === "/" ? "1.0" : path === "/docs" || path === "/llms.txt" ? "0.9" : "0.7"}</priority>
  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

/** Clear 402 JSON body so agents know exactly how to pay (PAYMENT-REQUIRED header remains authoritative). */
export function paymentRequiredBody(origin: string, pricePerTool: number) {
  return {
    error: "payment_required",
    message: `Payment required: $${pricePerTool} USDC Exact on Base (eip155:8453) per tool checked. Read the PAYMENT-REQUIRED header, create a PAYMENT-SIGNATURE, and retry.`,
    howToPay: {
      scheme: "exact",
      network: "eip155:8453",
      asset: "USDC",
      pricePerToolUsd: pricePerTool,
      steps: [
        "Decode the PAYMENT-REQUIRED response header (base64 JSON, x402 v2).",
        "Build a PAYMENT-SIGNATURE covering accepts[0] (amount is atomic USDC units; $0.002 = \"2000\").",
        "Retry the same request with header PAYMENT-SIGNATURE.",
        "Or use an x402 client: npm i @x402/fetch / @x402/axios with ExactEvmScheme.",
      ],
      docs: `${origin}/docs`,
      openapi: `${origin}/openapi.json`,
      llms: `${origin}/llms.txt`,
      example: `GET ${origin}/preflight?url=https://seller.example/x402`,
    },
  };
}
