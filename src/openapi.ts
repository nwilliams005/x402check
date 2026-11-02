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
    protocols: [
      { x402: { scheme: "exact", network: "eip155:8453", asset: "USDC" } },
    ],
  };
  const paymentInfoDynamic = {
    price: {
      mode: "dynamic" as const,
      currency: "USD",
      min: amount,
      max: (unit * 25).toFixed(6),
    },
    protocols: [
      { x402: { scheme: "exact", network: "eip155:8453", asset: "USDC" } },
    ],
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "x402check",
      version: "0.3.0",
      termsOfService: `${origin}/terms`,
      summary:
        "Check before paying any x402 API — paid trust preflight (ok|caution|avoid + history)",
      description:
        "Call BEFORE any x402 payment to a third-party tool (check before paying). Checks are paid " +
        `($${unit}/tool). GET checks one URL; POST batches up to 25 (N×unit in one Exact settlement). ` +
        "Response: compact verdict (ok|caution|avoid) + that tool's history only (checks, uptime, payTo/price changes). " +
        "Use for: is this API a scam; is this x402 endpoint safe/legit; verify payTo before signing USDC; detect wallet or price drift; " +
        "uptime / is-it-down; compare sellers; budget guard; validate payment requirements; debug a failing 402; " +
        "audit log of why you paid or refused. Probes are read-only — we never pay the target. " +
        "Endpoint+history product (not wallet OFAC/drainer/simulation). If verdict=avoid do not pay. Cache-fresh targets <300ms. " +
        `Live honest usage: ${origin}/stats.`,
      contact: {
        name: "x402check",
        email: "hustlelab@mail.grokbot.com",
        url: origin,
      },
      "x-guidance":
        "Preflight before paying any x402 tool: always call GET /preflight?url=SELLER_URL (or POST batch) before PAYMENT-SIGNATURE to that seller. " +
        "Deny payment when verdict=avoid; escalate when caution; still enforce your maxAmount when ok. " +
        `Unit price $${unit} USDC Exact on Base (eip155:8453), billed per tool URL. One free regular check ever per wallet via /preflight/free (not deep/batch; not a scan substitute). ` +
        "Use when: is this API a scam; is this x402 endpoint safe; verify payTo; detect rug-style payTo/price swaps; check uptime; " +
        "compare/cheapest/most reliable among candidates; budget guard; validate 402 requirements; debug failing settle; " +
        "compliance/audit trail before signing. MCP aliases: verify_payto, compare_tools; optional deep_check ($0.05); optional watch_tool ($5/30d). " +
        `Discovery: ${origin}/llms.txt ${origin}/.well-known/agent-card.json ${origin}/.well-known/ai-catalog.json ${origin}/mcp/server-card ${origin}/openapi.json ${origin}/stats`,
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
        agents: `${origin}/AGENTS.md`,
        skills: `${origin}/skills.md`,
        skillsJson: `${origin}/.well-known/skills.json`,
        stats: `${origin}/stats`,
      },
      "x-keywords": [
        "check before paying",
        "is this API a scam",
        "is this x402 endpoint safe",
        "verify payTo",
        "x402 preflight",
        "agent trust",
        "budget guard",
      ],
    },
    servers: [{ url: origin, description: "This deployment" }],
    tags: [
      { name: "preflight", description: "Paid trust checks" },
      { name: "watch", description: "Optional $5/30d daily re-check + webhook alerts" },
      { name: "stats", description: "Live aggregate usage (honest counts)" },
      { name: "discovery", description: "Free agent discovery documents" },
    ],
    paths: {
      "/preflight": {
        get: {
          operationId: "preflightCheck",
          tags: ["preflight"],
          summary: "Check one x402 seller URL before paying it",
          description:
            "WHEN TO USE: check before paying / immediately before settling payment to any x402 tool; when asking is this API a scam; " +
            "is this endpoint safe/legit; verify payTo / receiving wallet; detect price or wallet drift; check uptime / is it down; validate payment " +
            "requirements before signing USDC on Base; budget guard; debug a failing 402; compliance log before pay. " +
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
          summary: "Batch / compare trust-check; charged per URL",
          description:
            "WHEN TO USE: compare multiple candidate x402 tools; pick cheapest or most reliable; screen Bazaar search hits " +
            "before paying any of them. " +
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
      "/preflight/deep": {
        get: {
          operationId: "deepCheck",
          tags: ["preflight"],
          summary: "Deep check one x402 seller URL ($0.05 Exact)",
          description:
            "OPTIONAL deeper signal when the base preflight is not enough. Runs the same live 402 + history as GET /preflight, then repeated probes for payTo/price consistency, a recent public Base USDC-to-payTo transfer sample, Bazaar + 402 Index listing checks, and drift vs last KV history. Does not claim OFAC, wallet simulation, or full chain history.",
          security: [{ x402Payment: [] }],
          parameters: [
            {
              name: "url",
              in: "query",
              required: true,
              schema: { type: "string", format: "uri" },
              description: "Absolute https URL of the x402 seller to deep-check",
              example: "https://www.api-xpay.com/x402/ping",
            },
          ],
          "x-payment-info": {
            price: { mode: "fixed", currency: "USD", amount: "0.050000" },
            protocols: [
              { x402: { scheme: "exact", network: "eip155:8453", asset: "USDC" } },
            ],
          },
          responses: {
            "200": {
              description: "DeepCheckResult (ToolCheck + priceConsistency, onChainPayTo, listings, driftVsLast)",
            },
            "400": { description: "missing_url | blocked host" },
            "402": { description: "Payment Required — $0.05 Exact (50000 atomic USDC)" },
          },
        },
      },
      "/preflight/free/challenge": {
        get: {
          operationId: "freeCheckChallenge",
          tags: ["preflight", "free"],
          summary: "Issue a one-time free regular-check challenge for a wallet",
          description:
            "Starts the one free regular (single-URL) check ever per agent wallet. " +
            "Returns a short-lived EIP-191 message to sign (ERC-1271 smart wallets supported). " +
            "Deep/batch are never free. This is not a scanner substitute — live trust checks remain paid after the single free claim.",
          security: [],
          parameters: [
            {
              name: "address",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "0x-prefixed wallet address that will sign the challenge",
            },
          ],
          responses: {
            "200": { description: "FreeChallenge { address, nonce, expiresAt, message }" },
            "400": { description: "invalid_address | already_used | rate_limited" },
          },
        },
      },
      "/preflight/free": {
        post: {
          operationId: "freeCheckRedeem",
          tags: ["preflight", "free"],
          summary: "Redeem the one free regular check for a wallet",
          description:
            "Burns the lifetime free claim for the signing wallet, then runs one regular ToolCheck. " +
            "Requires a valid challenge signature. Subsequent regular checks require paid /preflight.",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url", "address", "nonce", "signature"],
                  properties: {
                    url: { type: "string", format: "uri" },
                    address: { type: "string" },
                    nonce: { type: "string" },
                    signature: { type: "string", description: "EIP-191 or ERC-1271 signature over challenge.message" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "ToolCheck (same shape as paid GET /preflight)" },
            "400": { description: "invalid_json | invalid_signature | already_used | challenge_expired | blocked host" },
            "429": { description: "rate_limited" },
          },
        },
      },
      "/scan": {
        get: {
          operationId: "scanExplain",
          tags: ["owners"],
          summary: "Owner verify & badge explain page (HTML) — no public scan data",
          description:
            "Marketing/explain page for endpoint owners: how to verify ownership, view a private snapshot, and opt into a badge. " +
            "Does not expose ecosystem tallies, per-endpoint grades, JSON exports, or a public directory. Agents should use paid /preflight.",
          security: [],
          responses: { "200": { description: "HTML explain + CTA" } },
        },
      },
      "/owner": {
        get: {
          operationId: "ownerDashboardPage",
          tags: ["owners"],
          summary: "Owner dashboard UI (HTML)",
          security: [],
          responses: { "200": { description: "HTML owner dashboard" } },
        },
      },
      "/owner/challenge": {
        post: {
          operationId: "ownerChallenge",
          tags: ["owners"],
          summary: "Start owner verification challenge for an endpoint URL",
          description:
            "Probes the URL for a live payTo and returns a signature message plus DNS/well-known fallback token. " +
            "Primary proof: EIP-191/ERC-1271 as payTo. Fallback: DNS TXT x402check-verify=… or /.well-known/x402check-verify.txt.",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: { url: { type: "string", format: "uri" } },
                },
              },
            },
          },
          responses: {
            "200": { description: "OwnerChallenge" },
            "400": { description: "invalid_url | probe_failed | rate_limited" },
          },
        },
      },
      "/owner/verify": {
        post: {
          operationId: "ownerVerifyPayTo",
          tags: ["owners"],
          summary: "Verify ownership via payTo wallet signature",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["challengeId", "signature"],
                  properties: {
                    challengeId: { type: "string" },
                    signature: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "{ ok, sessionToken, url }" },
            "400": { description: "verification_failed (generic)" },
          },
        },
      },
      "/owner/verify-dns": {
        post: {
          operationId: "ownerVerifyDns",
          tags: ["owners"],
          summary: "Verify ownership via DNS TXT or well-known file",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["challengeId"],
                  properties: {
                    challengeId: { type: "string" },
                    method: { type: "string", enum: ["dns", "wellknown"] },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "{ ok, sessionToken, url }" },
            "400": { description: "verification_failed (generic)" },
          },
        },
      },
      "/owner/dashboard": {
        get: {
          operationId: "ownerDashboard",
          tags: ["owners"],
          summary: "Private snapshots for endpoints this session verified",
          description:
            "Requires Authorization: Bearer <sessionToken>. Returns only endpoints the session owns. " +
            "Snapshots are periodic scanner grades — not live paid preflights. No other endpoints are enumerable.",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "{ endpoints[], note }" },
            "401": { description: "unauthorized" },
          },
        },
      },
      "/owner/badge": {
        post: {
          operationId: "ownerBadgeOptIn",
          tags: ["owners", "badge"],
          summary: "Opt in to a Verified-by-x402check badge for a verified endpoint",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: { url: { type: "string", format: "uri" } },
                },
              },
            },
          },
          responses: {
            "200": { description: "{ badgeId, embedPath, embedUrl, snippet }" },
            "401": { description: "unauthorized" },
            "404": { description: "not_found (generic)" },
          },
        },
        delete: {
          operationId: "ownerBadgeRevoke",
          tags: ["owners", "badge"],
          summary: "Revoke badge for a verified endpoint",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: { url: { type: "string", format: "uri" } },
                },
              },
            },
          },
          responses: {
            "200": { description: "{ ok, revoked }" },
            "401": { description: "unauthorized" },
            "404": { description: "not_found" },
          },
        },
      },
      "/badge/{id}": {
        get: {
          operationId: "publicBadgeSvg",
          tags: ["badge"],
          summary: "Public badge SVG (unguessable id; empty 404 otherwise)",
          description:
            "Serves a simple pass + last-verified-date SVG only when the badge is opted-in and the latest private snapshot is pass. " +
            "Unknown, revoked, or non-pass ids return empty 404 with no leakage. Id may include optional .svg suffix.",
          security: [],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Unguessable badge id (optionally ending in .svg)",
            },
          ],
          responses: {
            "200": { description: "image/svg+xml" },
            "404": { description: "empty body" },
          },
        },
      },
      "/terms": {
        get: {
          operationId: "getTerms",
          summary: "Terms of Use (HTML)",
          tags: ["Discovery"],
          responses: {
            "200": { description: "HTML Terms of Use" },
          },
        },
      },
      "/privacy": {
        get: {
          operationId: "getPrivacy",
          summary: "Privacy Policy (HTML)",
          tags: ["Discovery"],
          responses: {
            "200": { description: "HTML Privacy Policy" },
          },
        },
      },
      "/cookies": {
        get: {
          operationId: "getCookies",
          summary: "Cookie Notice (HTML)",
          tags: ["Discovery"],
          responses: {
            "200": { description: "HTML Cookie Notice" },
          },
        },
      },
      "/stats": {
        get: {
          operationId: "getStats",
          tags: ["stats"],
          summary: "Live aggregate check stats (real KV counts, never padded)",
          description:
            "Returns totalChecks, paidChecks, toolsChecked, flaggedOk/caution/avoid, last-24h counters, and optional verified onChain Base USDC transfer snapshot. " +
            "Counts start from when stats recording shipped; small numbers are shown honestly.",
          security: [],
          responses: {
            "200": {
              description: "StatsSnapshot",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/StatsSnapshot" },
                },
              },
            },
          },
        },
      },
      "/watch": {
        post: {
          operationId: "createWatch",
          tags: ["watch"],
          summary: "Start a 30-day watch ($5 Exact USDC)",
          description:
            "OPTIONAL after a one-shot preflight. Registers one seller URL for daily re-checks. " +
            "Webhook (https) fires when payTo, price, network, or availability changes. " +
            "One Exact payment of $5 USDC on Base buys 30 days; renew with POST /watch/renew.",
          security: [{ x402Payment: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: {
                    url: { type: "string", format: "uri" },
                    webhookUrl: { type: "string", format: "uri", description: "https webhook for alerts" },
                    email: { type: "string", format: "email", description: "Stored for future email alerts; webhook is live today" },
                  },
                },
                example: {
                  url: "https://www.api-xpay.com/x402/ping",
                  webhookUrl: "https://hooks.example.com/x402check",
                },
              },
            },
          },
          "x-payment-info": {
            scheme: "exact",
            network: "eip155:8453",
            price: "$5",
            asset: "USDC",
            pricingModel: "watch_30d",
          },
          responses: {
            "200": { description: "Watch created with baseline + watchId" },
            "400": { description: "missing_url | invalid_webhook | blocked_host" },
            "402": { description: "Payment Required — $5 Exact (5000000 atomic USDC)" },
          },
        },
        get: {
          operationId: "getWatch",
          tags: ["watch"],
          summary: "Free watch status by id",
          security: [],
          parameters: [
            {
              name: "id",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "watchId from POST /watch",
            },
          ],
          responses: {
            "200": { description: "WatchRecord (public)" },
            "400": { description: "missing_id" },
            "404": { description: "not_found" },
          },
        },
      },
      "/watch/renew": {
        post: {
          operationId: "renewWatch",
          tags: ["watch"],
          summary: "Renew a watch for another 30 days ($5 Exact)",
          security: [{ x402Payment: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["watchId"],
                  properties: {
                    watchId: { type: "string" },
                    id: { type: "string" },
                  },
                },
              },
            },
          },
          "x-payment-info": {
            scheme: "exact",
            network: "eip155:8453",
            price: "$5",
            asset: "USDC",
            pricingModel: "watch_30d",
          },
          responses: {
            "200": { description: "Watch renewed" },
            "402": { description: "Payment Required — $5 Exact" },
            "404": { description: "not_found" },
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
      "/example": {
        get: {
          operationId: "exampleResponse",
          tags: ["discovery"],
          summary: "Free static sample ToolCheck (not a live probe)",
          description:
            "Returns a fixed sample JSON matching a successful paid check so agents can inspect the shape before paying. " +
            "sample:true. Never hits a seller or KV. Real checks: GET /preflight with x402 v2 PAYMENT-SIGNATURE.",
          responses: {
            "200": {
              description: "Static example payload",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      sample: { type: "boolean" },
                      note: { type: "string" },
                      pricePerToolUsd: { type: "number" },
                      result: { $ref: "#/components/schemas/ToolCheck" },
                    },
                  },
                },
              },
            },
          },
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
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Opaque owner session from /owner/verify or /owner/verify-dns",
        },
      },
      schemas: {
        StatsSnapshot: {
          type: "object",
          properties: {
            totalChecks: { type: "integer" },
            paidChecks: { type: "integer" },
            onChain: {
              type: "object",
              nullable: true,
              description:
                "Verified Base USDC Transfer snapshot to payTo (seeded from eth_getLogs). Never fabricated.",
            },
            toolsChecked: { type: "integer" },
            flaggedOk: { type: "integer" },
            flaggedCaution: { type: "integer" },
            flaggedAvoid: { type: "integer" },
            last24hChecks: { type: "integer" },
            last24hCaution: { type: "integer" },
            last24hAvoid: { type: "integer" },
            updatedAt: { type: "string", nullable: true },
            watch: {
              type: "object",
              description: "Optional product hint",
              properties: {
                priceUsd: { type: "number" },
                durationDays: { type: "integer" },
                endpoint: { type: "string" },
              },
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
          },
        },
        PaymentRequired: {
          type: "object",
          required: ["error", "x402Version", "accepts"],
          properties: {
            error: { type: "string", const: "payment_required" },
            x402Version: { type: "integer", const: 2 },
            accepts: {
              type: "array",
              minItems: 1,
              description: "x402 v2 PaymentRequirements — mirrors PAYMENT-REQUIRED header",
              items: {
                type: "object",
                required: ["scheme", "network", "amount", "asset", "payTo"],
                properties: {
                  scheme: { type: "string" },
                  network: { type: "string", example: "eip155:8453" },
                  amount: { type: "string", description: "Atomic USDC amount" },
                  asset: { type: "string" },
                  payTo: { type: "string" },
                  maxTimeoutSeconds: { type: "integer" },
                  extra: { type: "object" },
                },
              },
            },
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
    version: "0.3.0",
    description:
      "Check before paying any x402 seller URL. Returns ok|caution|avoid + history (uptime, payTo/price changes). Paid per tool. Use for is-this-API-a-scam, safety, verify-payTo, compare tools, uptime, budget guard, debug 402, optional watch.",
    transport: { type: "streamable-http", url: `${origin}/mcp` },
    serverCard: `${origin}/mcp/server-card`,
    legacyServerCard: `${origin}/.well-known/mcp/server-card.json`,
    aiCatalog: `${origin}/.well-known/ai-catalog.json`,
    pricing: {
      model: "x402-exact",
      pricePerToolUsd: pricePerTool,
      deepCheckUsd: 0.05,
      watchUsd: 5,
      batch: "MCP batch / POST /preflight {urls[]} → one Exact settlement of N×unit",
      mcpTransport:
        "Unpaid tools/call → PaymentRequired in structuredContent + content[0].text; retry with params._meta['x402/payment']; success → result._meta['x402/payment-response']. Spec: x402-foundation transports-v2/mcp.md",
      limitation:
        "Exact scheme = one settlement per request; batch is summed N×unit, not N separate txs.",
    },
    tools: [
      {
        name: "preflight_check",
        description:
          "Check before paying one x402 seller URL. Call when about to settle, asking is this API a scam / is this endpoint safe/legit, checking uptime, validating 402 requirements, or debugging a failed settle. Deny pay if verdict=avoid.",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", description: "Absolute https x402 endpoint" },
            fresh: { type: "boolean" },
          },
        },
        annotations: {
          title: "x402 endpoint trust preflight",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
        endpoint: { method: "GET", path: "/preflight", query: ["url", "fresh"] },
      },
      {
        name: "verify_payto",
        description:
          "Verify payTo / receiving wallet from the seller's live 402 + history.payToChanges. Use before signing USDC on Base.",
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
        endpoint: { method: "GET", path: "/preflight", query: ["url", "fresh"] },
      },
      {
        name: "preflight_batch",
        description:
          "Trust-check multiple seller URLs; charged per URL. Use to compare candidates or screen Bazaar hits.",
        inputSchema: {
          type: "object",
          required: ["urls"],
          properties: {
            urls: { type: "array", items: { type: "string" }, maxItems: 25 },
            fresh: { type: "boolean" },
          },
        },
        annotations: {
          title: "Batch x402 trust preflight",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
        endpoint: { method: "POST", path: "/preflight" },
      },
      {
        name: "compare_tools",
        description:
          "Compare x402 sellers (verdict, price, payTo, uptime, drift). Alias of preflight_batch; charged per URL.",
        inputSchema: {
          type: "object",
          required: ["urls"],
          properties: {
            urls: { type: "array", items: { type: "string" }, maxItems: 25 },
            fresh: { type: "boolean" },
          },
        },
        annotations: {
          title: "Compare x402 tools",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
        endpoint: { method: "POST", path: "/preflight" },
      },
      {
        name: "deep_check",
        description:
          "Optional $0.05 deep trust check: base preflight plus repeated probes, public Base USDC-to-payTo sample, Bazaar/402 Index listings, and KV drift. Not OFAC or wallet simulation.",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", description: "Absolute https x402 endpoint" },
          },
        },
        annotations: {
          title: "Deep x402 endpoint trust check",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
        endpoint: { method: "GET", path: "/preflight/deep", query: ["url"] },
      },
      {
        name: "watch_tool",
        description:
          "Optional $5 Exact / 30d daily re-check + webhook on payTo/price/network/availability change. After a one-shot or deep check when you will revisit the same seller.",
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
        endpoint: { method: "POST", path: "/watch" },
      },
    ],
    adoptionHints: [
      "Use npm x402check-client (preflight, opt-in wrapFetch / createAxiosRequestInterceptor) to auto-call preflight before paying any x402 tool. Those helpers pay x402check ($0.01 after 1 free check/wallet).",
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

> Paid per-tool trust preflight before an AI agent pays an x402 endpoint. Unit $${pricePerTool} USDC Exact on Base (eip155:8453). One free regular check ever per agent wallet (GET/POST /preflight/free*). Batch = N × unit in one payment. Optional deep check $0.05. Optional watch $5 / 30 days. No public scanner dataset.

Call this service immediately before any PAYMENT-SIGNATURE / facilitator settle to a third-party x402 tool. If verdict=avoid, do not pay. If caution, escalate. If ok, still enforce your maxAmount. Probes are read-only GET; we never pay the target. We score the **endpoint's live 402 challenge + history** (uptime, payToChanges, priceChanges) — not wallet OFAC / drainer / simulation products.

Exact settles one amount per HTTP request. Batch uses DynamicPrice = len(urls)*unit. Cache-fresh responses target <300ms so agents do not skip for latency.

## When to use x402check

- Check before paying any x402 endpoint / before PAYMENT-SIGNATURE
- When a human or agent asks: is this API a scam? is this x402 endpoint safe? is this API legit?
- Stop an agent from paying a shady or rotated seller wallet
- Verify payTo / receiving wallet before signing a USDC transfer on Base
- Detect payTo rotation or sudden price hikes (rug-style seller changes)
- Check uptime / is the endpoint down / unreachable before you pay
- Compare several tools: cheapest, most reliable, or screen Bazaar search hits
- Budget guard / spending safety for autonomous micropayments
- Validate payment requirements (accepts[], network, amount) before signing
- Debug a failing 402 or malformed PAYMENT-REQUIRED
- Compliance / audit log: evidence for why you paid or refused

## Docs

- [OpenAPI](${origin}/openapi.json): Machine contract with x-payment-info, schemas, x-guidance
- [Full LLM docs](${origin}/llms-full.txt): Concatenated FAQ + API reference
- [Human docs](${origin}/docs): Usage for operators
- [Docs markdown](${origin}/docs.md): LLM-friendly docs twin
- [Home markdown](${origin}/index.md): Landing twin
- [A2A Agent Card](${origin}/.well-known/agent-card.json): Agent2Agent discovery card
- [AI Catalog](${origin}/.well-known/ai-catalog.json): Domain MCP/A2A catalog (SEP-2127)
- [x402 well-known](${origin}/.well-known/x402): x402scan compatibility discovery
- [MCP descriptor](${origin}/mcp.json): Tool list + pricing for MCP hosts
- [MCP Server Card](${origin}/mcp/server-card): SEP-2127 card (streamable-http)
- [Legacy MCP card](${origin}/.well-known/mcp/server-card.json): Smithery scan fallback
- [MCP endpoint](${origin}/mcp): Streamable-HTTP JSON-RPC (tools/list free; paid tools/call settle x402 Exact via \`_meta['x402/payment']\` per transports-v2/mcp.md)
- [Intent map](${origin}/docs): See site docs / INTENTS.md in repo for full prompt coverage
- [Sitemap](${origin}/sitemap.xml): Search-engine sitemap
- [Terms of Use](${origin}/terms): Pricing, advisory disclaimers, Alabama law
- [Privacy Policy](${origin}/privacy): What we store (watch emails, stats) and processors
- [Cookie Notice](${origin}/cookies): No first-party cookies or analytics trackers

## Endpoints

- [GET /preflight](${origin}/preflight): Query url=https://seller… → ToolCheck (402 if unpaid)
- [POST /preflight](${origin}/preflight): Body {"urls":[…]} → BatchResult (charged per URL)
- [GET /preflight/free/challenge](${origin}/preflight/free/challenge): Query address=0x… → signable challenge (one free regular check ever per wallet)
- [POST /preflight/free](${origin}/preflight/free): Body {url,address,nonce,signature} → ToolCheck; burns lifetime free claim
- [GET /preflight/deep](${origin}/preflight/deep): Optional $0.05 deep check (multi-probe + listings + recent on-chain sample + KV drift)
- [GET /stats](${origin}/stats): Live aggregate counts of **paid/product usage** (honest KV totals; never padded). Not a public scanner dataset.
- [GET /scan](${origin}/scan): Owner verify + badge explain page (HTML). No public grades, tallies, or JSON export of scan results.
- [POST /owner/challenge](${origin}/owner/challenge) / [POST /owner/verify](${origin}/owner/verify) / [POST /owner/verify-dns](${origin}/owner/verify-dns): Prove endpoint ownership (payTo sig or DNS/well-known)
- [GET /owner/dashboard](${origin}/owner/dashboard): Bearer session → private snapshots for **your** endpoints only
- [POST/DELETE /owner/badge](${origin}/owner/badge): Opt in / revoke Verified-by-x402check badge
- [GET /badge/{id}.svg](${origin}/badge/ID.svg): Public badge image if active + pass; else empty 404
- [POST /watch](${origin}/watch): Optional $5 Exact / 30d daily re-check + webhook on payTo/price/network/availability change
- [GET /watch](${origin}/watch): Query id= → watch status (free)
- [POST /watch/renew](${origin}/watch/renew): Renew watch another 30 days ($5 Exact)


## Owners / scanner (private)

Internal periodic scans store private grades for verified owners only. There is **no** public scan directory, per-endpoint public grade page, aggregate scan stats page, or JSON export of scanner data. /scan explains ownership verification and the optional badge. Agents must use paid /preflight (or the one free regular check) — never treat a snapshot as a live settle decision.

## MCP tools

Paid tools settle on the MCP call itself (not a separate HTTP hop):

1. Unpaid \`tools/call\` → \`isError: true\` + \`PaymentRequired\` in \`structuredContent\` and \`content[0].text\` (\`accepts[]\` = Base Exact USDC, same payTo/amount as HTTP 402).
2. Client retries with \`params._meta["x402/payment"]\` = PaymentPayload.
3. Success → tool data + \`result._meta["x402/payment-response"]\` (SettleResponse).

Spec: https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/mcp.md

- \`preflight_check\` — single URL trust preflight ($${pricePerTool})
- \`verify_payto\` — same billing; focused on receiving wallet + payToChanges
- \`preflight_batch\` — up to 25 URLs
- \`compare_tools\` — same billing as batch; compare candidates
- \`deep_check\` — optional $0.05 deeper signal (repeated probes, public Base USDC-to-payTo sample, Bazaar/402 Index, KV drift)
- \`watch_tool\` — optional $5 Exact / 30d daily re-check + webhook (fixed price)

## Optional deep check ($0.05)

When the base check is not enough signal: GET /preflight/deep or MCP deep_check. Adds repeated live probes, a recent public Base USDC Transfer sample into the seller payTo, Bazaar + 402 Index listing samples, and drift vs last KV history. Honest about limits — not OFAC, not wallet simulation, not full chain history.

## Optional watch ($5 / 30 days)

If you will revisit the same seller, POST /watch (or MCP watch_tool) registers the URL for daily re-checks. Webhook/email alerts when payTo, price, network, or availability changes. Status: GET /watch?id=. Renew: POST /watch/renew. Helpful add-on after a one-shot or deep check — never required for a single settle.

## Response fields (stable)

url, verdict (ok|caution|avoid), checkedAt, live, cacheAgeMs, status, latencyMs, is402, priceUsd, payTo, network, reasonCodes[], history{checks,uptimePct,payToChanges,priceChanges,recent}

## Policy

- verdict=avoid → do not pay the target
- verdict=caution → escalate / require human confirm
- verdict=ok → still enforce your maxAmount and allowlist rules

## Install

- \`npm install x402check-client\` then \`import { preflight, assertPayable, withPreflightPay } from 'x402check-client'\` with env \`X402CHECK_URL=https://x402check.dev\`
- \`npm install -g x402check-mcp\` then \`X402CHECK_URL=https://x402check.dev x402check-mcp\` (MCP Registry name \`dev.x402check/mcp\`)
- Remote MCP (no local bridge): \`${origin}/mcp\` streamable-http

## Integrations

- [x402check-ai-sdk](https://www.npmjs.com/package/x402check-ai-sdk) — Vercel AI SDK \`tool()\` defs + \`beforePayment\` guard
- [x402check-langchain](https://www.npmjs.com/package/x402check-langchain) — LangChain JS / LangGraph tools
- [plugin-x402check](https://www.npmjs.com/package/plugin-x402check) — ElizaOS plugin (preflight / verify_payto / compare)
- [x402check-langchain (PyPI)](https://pypi.org/project/x402check-langchain/) — LangChain Python tools
- MCP Registry name \`dev.x402check/mcp\`
- [x402check-cloudflare-agent](https://github.com/nwilliams005/x402check-cloudflare-agent) — Cloudflare Agents / Workers template
- [x402check-examples](https://github.com/nwilliams005/x402check-examples) — OpenAI Agents SDK, LlamaIndex, CrewAI examples
- Source monorepo: [nwilliams005/x402check](https://github.com/nwilliams005/x402check)

## Optional

- [Client wrapper](${origin}/docs): npm \`x402check-client\` — wrap pay() with preflight
- [MCP bridge](${origin}/docs): npm \`x402check-mcp\` — stdio → remote /mcp
- [Home](${origin}/): Landing
`;
}

export function llmsFullTxt(origin: string, pricePerTool: number): string {
  return `${llmsTxt(origin, pricePerTool)}

---

# x402check full reference

## FAQ for agents and people

### Is this x402 endpoint safe?
Preview shape free: GET ${origin}/example. Then call GET ${origin}/preflight?url=SELLER_URL (pay $${pricePerTool} USDC Exact on Base / x402 v2 PAYMENT-SIGNATURE). Read verdict. avoid = do not pay. caution = escalate. ok = still enforce maxAmount. history.payToChanges and history.priceChanges show drift. This is an endpoint+history check, not a warranty and not an OFAC/drainer scan of a wallet.

### How do I check before paying?
Always call GET ${origin}/preflight?url=SELLER_URL (or MCP \`preflight_check\` / npm \`x402check-client\`) before PAYMENT-SIGNATURE. Policy: avoid→deny, caution→confirm, ok→still enforce maxAmount. Live honest usage counts: GET ${origin}/stats.

### Is this API legit or a scam / rug?
We do not label "scam" as a legal finding. We surface reachability, whether a real 402 challenge exists, current payTo/price, and whether payTo or price changed over prior checks — signals agents use before paying. Treat avoid as deny; investigate caution.

### How do I verify payTo before signing USDC on Base?
ToolCheck.payTo is the address in the seller's live 402 challenge. Compare to any allowlist. history.payToChanges lists prior addresses if the seller rotated wallets. MCP alias: verify_payto.

### How do I detect price changes or a rug-style swap?
Inspect history.priceChanges and history.payToChanges on the ToolCheck. A sudden new payTo or large price jump is a caution/avoid signal depending on other reasons.

### Is the endpoint down? What's the uptime?
history.uptimePct, lastOkAt, lastFailAt, and live/status/latencyMs answer reachability. Prefer a fresh=1 probe if the agent already failed once.

### Which tool should I pay among several?
POST /preflight with urls[] (or MCP compare_tools). Compare verdict, priceUsd, uptimePct, and drift. Charge = N × $${pricePerTool} in one Exact settlement.

### Budget guard / spending safety?
Call preflight before every settle; deny on avoid; still enforce your own maxAmount on ok. Unit $${pricePerTool} keeps the check itself a micro-cost.

### Debug a failing 402 / validate payment requirements
A successful ToolCheck with is402=true returns parsed priceUsd, payTo, network, and reasonCodes from the live challenge — useful when facilitator settles fail or accepts[] look wrong.

### Compliance / audit logging
Persist the ToolCheck JSON (verdict, payTo, priceUsd, reasonCodes, history, checkedAt) alongside your payment decision. That is evidence you checked before signing.

### How do I pay x402check itself?
Unauthenticated calls return HTTP 402 with a PAYMENT-REQUIRED header (x402 v2). Amount for one tool is ${String(Math.round(pricePerTool * 1_000_000))} atomic USDC ($${pricePerTool}). Base deep check is $0.05 (50000 atomic). Sign with ExactEvmScheme on eip155:8453 (accepts[] lists Base Exact USDC). Retry with PAYMENT-SIGNATURE. Body.accepts[] mirrors the PAYMENT-REQUIRED header. See ${origin}/openapi.json x-payment-info.

### Does batch cost N times more?
Yes. POST /preflight with urls[] charges len(urls) × $${pricePerTool} in ONE Exact settlement (not N separate transactions). Max 25 URLs. One free regular (single-URL) check ever per wallet; deep/batch never free.

### Will this slow my agent down?
Cache-fresh responses target <300ms. Pass fresh=1 only when you need a live re-probe.

### Do you pay the target?
Never. We only issue a read-only GET to the seller URL to observe the 402 challenge metadata.

### How is this different from x402check.xyz?
Different product. x402check.dev checks the **seller endpoint** (live 402 + history). Wallet OFAC/phishing/drainer/simulation screening is out of scope here.

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


### Can I watch a seller over time?
Optional. POST /watch {url, webhookUrl} with $5 Exact USDC buys 30 days of daily re-checks. Webhook fires on payTo/price/network/availability change. MCP tool: watch_tool. Renew with POST /watch/renew. Email is stored for a future channel; webhook is live today.

### Where are live stats?
GET /stats returns real KV aggregates (totalChecks, paidChecks, toolsChecked, flagged caution/avoid, last-24h) plus optional onChain (verified Base USDC transfers to payTo). Numbers are never fabricated or padded.

`;
}

export function landingMarkdown(origin: string, pricePerTool: number): string {
  return `# x402check

> Check before paying any x402 tool. $${pricePerTool} USDC Exact per tool. Optional deep $0.05. Optional watch $5/30d. One free regular check per wallet. No public scan grades.

Checks are paid (one free regular check per wallet). You get that tool's **verdict** (ok|caution|avoid) plus its **history** (uptime, payTo changes, price changes) — nothing else. Use when asking is this API a scam / is this endpoint safe, before PAYMENT-SIGNATURE, to verify payTo, detect drift, compare sellers, or as a budget guard. Cache-fresh responses target <300ms. Live counts: [stats](${origin}/stats).

## Quick start

\`\`\`
GET ${origin}/preflight?url=https://seller.example/x402
\`\`\`

Pay $${pricePerTool} via x402 Exact on Base, then retry with PAYMENT-SIGNATURE.

## Machine-readable

- [OpenAPI](${origin}/openapi.json)
- [llms.txt](${origin}/llms.txt)
- [Live stats](${origin}/stats)
- [Terms of Use](${origin}/terms)
- [Privacy Policy](${origin}/privacy)
- [Cookie Notice](${origin}/cookies)
- [MCP Server Card](${origin}/mcp/server-card)
- [A2A Agent Card](${origin}/.well-known/agent-card.json)
- [AI Catalog](${origin}/.well-known/ai-catalog.json)

## Optional watch

POST /watch {url, webhookUrl} — $5 Exact USDC / 30 days daily re-check + webhook on change. MCP: watch_tool.

## Docs

See [docs.md](${origin}/docs.md) or [docs](${origin}/docs).
`;
}

export function docsMarkdown(origin: string, pricePerTool: number): string {
  return `# x402check agent docs

Paid per tool. Unit **$${pricePerTool}** USDC Exact on Base (eip155:8453). One free regular check ever per wallet (/preflight/free). Optional deep check **$0.05** (GET /preflight/deep · MCP deep_check). Optional watch **$5 / 30 days**. Scan snapshots are private (owner dashboard only) — not a public dataset.

Live stats: GET /stats (honest KV counts).

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

- Client wrapper that calls preflight before any x402 pay (\`x402check-client\`)
- Runtime skill/middleware default-on with env kill-switch
- Policy: avoid→deny, caution→confirm, ok→still enforce maxAmount
- Bazaar listing + OpenAPI + MCP descriptor
- Keep p95 <300ms via cache so agents don't skip

## Integrations

- npm \`x402check-ai-sdk\` — Vercel AI SDK tools + beforePayment
- npm \`x402check-langchain\` — LangChain JS tools
- npm \`plugin-x402check\` — ElizaOS plugin
- PyPI \`x402check-langchain\` — LangChain Python tools
- MCP Registry \`dev.x402check/mcp\` — stdio npm \`x402check-mcp\` or remote ${origin}/mcp
- GitHub \`nwilliams005/x402check-cloudflare-agent\` — Cloudflare Agents template
- GitHub \`nwilliams005/x402check-examples\` — OpenAI Agents / LlamaIndex / CrewAI

## When to use (prompt coverage)

- Check before paying any x402 endpoint / before signing USDC on Base
- Is this API a scam? Is this x402 endpoint safe / legit?
- Verify payTo; detect payTo or price changes
- Uptime / is the endpoint down
- Compare tools; pick cheapest or most reliable
- Budget guard; audit log of payment decisions
- Validate 402 payment requirements; debug failing settles

## MCP tools

preflight_check · verify_payto · preflight_batch · compare_tools (per-URL billing) · deep_check ($0.05) · watch_tool ($5/30d).

MCP payment (transports-v2/mcp.md): unpaid tools/call → PaymentRequired (\`structuredContent.accepts\`); retry with \`params._meta["x402/payment"]\`; success → \`result._meta["x402/payment-response"]\`. Same Base Exact USDC / payTo as HTTP.

## Machine-readable

- [openapi.json](${origin}/openapi.json)
- [llms.txt](${origin}/llms.txt)
- [llms-full.txt](${origin}/llms-full.txt)
- [mcp.json](${origin}/mcp.json)
- [mcp/server-card](${origin}/mcp/server-card)
`;
}
