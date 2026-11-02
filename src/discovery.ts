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
      "Check before paying any x402 tool. Trust-check the seller URL: is this API a scam/legit, is it reachable, is the 402 real, what payTo/price does it demand, and has payTo or price drifted. Returns ok|caution|avoid + that tool's history only. Budget guard and compare helpers for agents. Paid per URL. Not a wallet OFAC/drainer scanner.",
    url: `${origin}/preflight`,
    preferredTransport: "HTTP+JSON",
    version: "0.3.0",
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
          "Check before paying one absolute https x402 seller URL. Use for: is this API a scam; is this endpoint safe/legit; verify payTo; detect price or wallet drift; check uptime; validate 402 payment requirements; budget guard before signing USDC on Base; debug a failing 402.",
        tags: [
          "x402",
          "trust",
          "preflight",
          "safety",
          "payTo",
          "verify",
          "uptime",
          "scam-check",
          "check-before-paying",
          "budget-guard",
        ],
        examples: [
          `GET ${origin}/preflight?url=https://seller.example/api (pay $${pricePerTool} first)`,
          "Is https://seller.example/x402 safe to pay?",
          "Is this API a scam before I pay?",
          "Check before paying this x402 tool",
          "Verify payTo for this x402 tool before settle",
          "Has this seller changed price or wallet?",
          "Is this x402 endpoint down?",
        ],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        id: "verify_payto",
        name: "Verify x402 payTo",
        description:
          "Extract and verify the receiving wallet (payTo) from a seller's live 402 challenge, with history of wallet rotations. Use before signing a USDC transfer.",
        tags: ["x402", "payTo", "verify", "wallet", "Base", "USDC"],
        examples: [
          "What payTo address does this x402 tool demand?",
          "Compare payTo to my allowlist before settle",
        ],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        id: "preflight_batch",
        name: "Compare / batch preflight x402 tools",
        description:
          "Trust-check up to 25 seller URLs in one request. Charged per URL (N × unit) in a single Exact settlement. Use when comparing candidates, picking cheapest/most reliable, or screening Bazaar hits before paying.",
        tags: ["x402", "trust", "batch", "compare", "cheapest", "reliable"],
        examples: [
          `POST ${origin}/preflight {"urls":["https://a.example","https://b.example"]}`,
          "Which of these paid APIs is safest and cheapest?",
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
      "Paid per-tool trust check before an agent pays an x402 endpoint. Verdict + history only (uptime, payTo/price changes). Use for: check before paying, is this API a scam, is this endpoint safe, verify payTo, detect rug-style wallet/price swaps, uptime, compare sellers, budget guard, debug failing 402.",
    openapi: `${origin}/openapi.json`,
    llms: `${origin}/llms.txt`,
    instructions:
      `Always GET ${origin}/preflight?url=SELLER before PAYMENT-SIGNATURE to that seller. Deny when verdict=avoid. Unit $${pricePerTool} USDC Exact on Base (eip155:8453).`,
    resources: [`${origin}/preflight`, `${origin}/preflight/deep`],
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
      {
        method: "GET",
        path: "/preflight/deep",
        description: "Optional deep check: multi-probe + listings + recent public Base USDC-to-payTo sample + KV drift.",
        priceUsd: 0.05,
        pricing: "fixed",
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
      "Check before paying x402 seller URLs. Answers is-this-API-a-scam, is-this-x402-endpoint-safe, verify-payTo, uptime, price drift, compare tools. Paid per tool via x402 Exact. Tools: preflight_check, verify_payto, preflight_batch, compare_tools, deep_check, watch_tool.",
    version: "0.3.0",
    url: `${origin}/mcp`,
    transport: "streamable-http",
    tools: [
      {
        name: "preflight_check",
        description:
          "Check before paying any x402 endpoint (is this API a scam / safe?). Call with the absolute https URL. Returns ok|caution|avoid plus that tool's history (checks, uptimePct, payToChanges, priceChanges). Also for uptime, debug failing 402, validate payment requirements. Do not pay if verdict=avoid.",
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
          title: "x402 endpoint trust preflight",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
      },
      {
        name: "verify_payto",
        description:
          "Verify the payTo receiving wallet from a seller's live 402 challenge, with history of wallet rotations. Use before signing USDC on Base.",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string" },
            fresh: { type: "boolean" },
          },
        },
        annotations: {
          title: "Verify x402 payTo",
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
          title: "Batch x402 trust preflight",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
      },
      {
        name: "compare_tools",
        description:
          "Compare candidate x402 sellers (verdict, price, payTo, uptime, drift). Alias of preflight_batch; charged per URL.",
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
          title: "Compare x402 tools",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
      },
      {
        name: "deep_check",
        description:
          "Optional $0.05 deep trust check: base preflight plus repeated probes, public Base USDC-to-payTo sample, Bazaar/402 Index listings, and KV drift.",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: {
              type: "string",
              description: "Absolute https URL of the x402 seller to deep-check",
            },
          },
        },
        annotations: {
          title: "Deep x402 endpoint trust check",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
      },
      {
        name: "watch_tool",
        description:
          "Optional $5 Exact / 30d daily re-check + webhook when payTo, price, network, or availability changes. After a one-shot preflight when you will revisit the same seller.",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string" },
            webhookUrl: { type: "string" },
            email: { type: "string" },
          },
        },
        annotations: {
          title: "Watch x402 tool for 30 days",
          readOnlyHint: false,
          openWorldHint: true,
          destructiveHint: false,
        },
      },
    ],
    pricing: {
      model: "x402-exact",
      pricePerToolUsd: pricePerTool,
      note: "Paid MCP tools settle via transports-v2/mcp.md: unpaid tools/call returns PaymentRequired (structuredContent.accepts); retry with params._meta['x402/payment']. Same Base Exact USDC + payTo as HTTP. watch_tool is a fixed $5/30d Exact payment.",
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
      `Check before paying x402 seller URLs ($${pricePerTool}/tool). Answers is-this-API-a-scam / is-this-endpoint-safe. Returns ok|caution|avoid + history (uptime, payTo/price changes). Use before PAYMENT-SIGNATURE; verify payTo; compare tools; budget guard; optional watch_tool. Endpoint+history check — not wallet OFAC/simulation.`,
    version: "0.3.0",
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
      "AI artifacts for x402check — check before paying any x402 endpoint; is this API a scam/safe; verify payTo, uptime, price drift, compare sellers.",
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
    "/stats",
    "/example",
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

/** Free static sample ToolCheck (not a live probe; no payment). */
export function exampleToolCheck(origin: string, pricePerTool: number) {
  return {
    sample: true,
    note:
      "Static example only — not a live probe and not billable. Call GET /preflight?url=… with an x402 v2 PAYMENT-SIGNATURE to run a real check.",
    pricePerToolUsd: pricePerTool,
    paidEndpoint: `${origin}/preflight`,
    docs: `${origin}/docs`,
    result: {
      url: "https://www.api-xpay.com/x402/ping",
      verdict: "ok",
      checkedAt: "2026-10-31T18:00:00.000Z",
      live: true,
      cacheAgeMs: 0,
      status: 402,
      latencyMs: 180,
      is402: true,
      priceUsd: 0.005,
      payTo: "0x589a2314a2E05F45e40C4823Da3Ba58D421dB3d8",
      network: "eip155:8453",
      reasonCodes: ["reachable", "http_402", "payto_stable"],
      history: {
        checks: 3,
        uptimePct: 100,
        lastOkAt: "2026-10-31T18:00:00.000Z",
        lastFailAt: null,
        payToChanges: [],
        priceChanges: [],
        recent: [
          {
            at: "2026-10-31T18:00:00.000Z",
            live: true,
            status: 402,
            priceUsd: 0.005,
            payTo: "0x589a2314a2E05F45e40C4823Da3Ba58D421dB3d8",
          },
        ],
      },
    },
  };
}

/**
 * Clear 402 JSON body so agents (and directories like x402dash) know how to pay.
 * PAYMENT-REQUIRED header remains authoritative (x402 v2). Body MUST include a
 * non-empty accepts[] mirroring the header (x402dash rejects otherwise).
 * Production advertises Base only; Solana stays behind ENABLE_SOLANA.
 */
export function paymentRequiredBody(
  origin: string,
  pricePerTool: number,
  accepts: Array<Record<string, unknown>>,
) {
  if (!Array.isArray(accepts) || accepts.length === 0) {
    throw new Error("paymentRequiredBody requires a non-empty accepts[]");
  }
  const atomic = String(Math.round(pricePerTool * 1_000_000));
  const primaryNet = String(accepts[0]?.network || "eip155:8453");
  return {
    error: "payment_required",
    x402Version: 2,
    // Required by x402dash + helpful for agents that only parse JSON bodies.
    accepts,
    message: `Payment required: $${pricePerTool} USDC Exact per tool on Base (${primaryNet}). This server speaks x402 v2 only. Decode PAYMENT-REQUIRED (or use body.accepts[]), sign, retry with PAYMENT-SIGNATURE.`,
    howToPay: {
      scheme: "exact",
      networks: [
        {
          network: primaryNet,
          networkAliases: { v2: primaryNet, v1LegacyName: "base" },
          asset: "USDC",
          assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          chainFamily: "evm",
          clientHint: "@x402/evm ExactEvmScheme on eip155:*",
        },
      ],
      network: primaryNet,
      networkAliases: { v2: primaryNet, v1LegacyName: "base" },
      asset: "USDC",
      assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      pricePerToolUsd: pricePerTool,
      amountAtomicUsdc: atomic,
      paymentHeaderIn: "PAYMENT-SIGNATURE",
      challengeHeaderOut: "PAYMENT-REQUIRED",
      legacyNote:
        "x402 v1 clients that only register ExactEvmClientV1 / network \"base\" fail here with \"No client registered for x402 version: 2\". Register ExactEvmScheme for eip155:* (or eip155:8453). Do not send X-PAYMENT alone — this server reads PAYMENT-SIGNATURE.",
      steps: [
        "Decode the PAYMENT-REQUIRED response header (base64 JSON, x402Version:2) or use body.accepts[].",
        `Build a PAYMENT-SIGNATURE covering accepts[0] (amount is atomic USDC; $${pricePerTool} = \"${atomic}\").`,
        "Retry the same request with header PAYMENT-SIGNATURE (not X-PAYMENT alone).",
        "Recommended: npm i @x402/fetch @x402/evm — wrapFetchWithPayment + ExactEvmScheme on eip155:*.",
        "MCP: tools/list is free; unpaid tools/call returns PaymentRequired (accepts[]); retry with params._meta[\"x402/payment\"] (same Exact USDC on Base as HTTP).",
        `Preview a sample JSON shape for free at GET ${origin}/example (static, not a live check).`,
      ],
      compatibleClients: [
        "@x402/fetch + ExactEvmScheme",
        "@x402/axios + ExactEvmScheme",
        "Coinbase AgentKit x402 action provider (v2)",
        "Cloudflare Agents withX402Client",
        "x402check-client (npm)",
        "x402check-ai-sdk (npm)",
        "x402check-langchain (npm)",
        "plugin-x402check (npm)",
      ],
      needsWallet: true,
      walletHint:
        "Caller needs a Base USDC-funded EVM wallet (or a custodial agent wallet that can sign Exact payments). No wallet → cannot settle.",
      docs: `${origin}/docs`,
      openapi: `${origin}/openapi.json`,
      llms: `${origin}/llms.txt`,
      sampleResponse: `${origin}/example`,
      example: `GET ${origin}/preflight?url=https://seller.example/x402`,
    },
  };
}
