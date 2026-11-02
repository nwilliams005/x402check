/**
 * x402 Tool Trust Preflight — paid per-tool checks (no free tier for probes).
 * Production: Base mainnet USDC via CDP (Solana behind ENABLE_SOLANA=false).
 * Dev: wrangler.dev.toml Base Sepolia. Do not deploy without Nicklaus's explicit approval.
 */
import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import type { HTTPRequestContext } from "@x402/core/server";
import type { Env, ToolCheck } from "./types";
import { createFacilitatorClient } from "./facilitator";
import { baseAcceptRequirement, buildAccepts, resolvePayConfig, USDC_BASE_MAINNET } from "./payconfig";
import { checkTool, isBlockedHost } from "./preflight";
import { deepCheck, deepUpsellHint, watchUpsellHint } from "./deep";
import {
  DEFAULT_PRICE_PER_TOOL_USD,
  DEEP_CHECK_PRICE_USD,
  DEEP_CHECK_ATOMIC,
  MAX_BATCH,
  WATCH_PRICE_USD,
  dynamicPriceForRequest,
  money,
  unitPriceUsd,
} from "./sell";
import { docsHtml, landingHtml, styleCss } from "./pages";
import { cookiesHtml, privacyHtml, termsHtml } from "./legal";
import { loadStats, recordCheckStats } from "./stats";
import {
  WATCH_DURATION_MS,
  WATCH_PRICE_ATOMIC,
  createWatch,
  loadWatch,
  publicWatch,
  renewWatch,
  runWatchCron,
  watchAcceptRequirement,
} from "./watch";
import {
  docsMarkdown,
  landingMarkdown,
  llmsFullTxt,
  llmsTxt,
  mcpDescriptor,
  openApiSpec,
} from "./openapi";
import {
  INDEXNOW_KEY,
  agentCard,
  agentJson,
  aiCatalog,
  exampleToolCheck,
  mcpServerCardLegacy,
  mcpServerCardSep,
  paymentRequiredBody,
  robotsTxt,
  sitemapXml,
  x402WellKnown,
} from "./discovery";
import { handleMcp } from "./mcp";

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="x402check">
  <rect width="128" height="128" rx="28" fill="#070b12"/>
  <rect x="10" y="10" width="108" height="108" rx="22" fill="#0e1520" stroke="#1e2a3a" stroke-width="4"/>
  <path d="M36 66l18 18 38-42" fill="none" stroke="#7dd3a7" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const app = new Hono<{ Bindings: Env }>();

/** CORS for browser/agent runtimes that probe paid routes before paying. */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, PAYMENT-SIGNATURE, PAYMENT-REQUIRED, X-PAYMENT, X-PAYMENT-RESPONSE, Accept",
  "Access-Control-Expose-Headers":
    "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE",
  "Access-Control-Max-Age": "86400",
};

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  await next();
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    if (!c.res.headers.has(k)) c.res.headers.set(k, v);
  }
});

/**
 * Bridge legacy X-PAYMENT → PAYMENT-SIGNATURE when the modern header is absent.
 * Does not make v1 payloads settleable (ResourceServer is x402 v2); it only helps
 * dual-header clients that still emit X-PAYMENT with a v2-shaped payload.
 */
function bridgeLegacyPaymentHeader(c: {
  req: { header: (n: string) => string | undefined; raw: Request };
}): void {
  const legacy = c.req.header("X-PAYMENT");
  const modern = c.req.header("PAYMENT-SIGNATURE");
  if (!legacy || modern) return;
  const headers = new Headers(c.req.raw.headers);
  headers.set("PAYMENT-SIGNATURE", legacy);
  const rebuilt = new Request(c.req.raw, { headers });
  // Replace the underlying Request so @x402/hono extractPayment sees PAYMENT-SIGNATURE.
  Object.defineProperty(c.req, "raw", { value: rebuilt, writable: true, configurable: true });
}

app.use("/preflight", async (c, next) => {
  bridgeLegacyPaymentHeader(c);
  await next();
});

app.use("/mcp", async (c, next) => {
  bridgeLegacyPaymentHeader(c);
  await next();
});

app.use("/watch", async (c, next) => {
  bridgeLegacyPaymentHeader(c);
  await next();
});

app.use("/watch/renew", async (c, next) => {
  bridgeLegacyPaymentHeader(c);
  await next();
});


/** Free live stats — real counters from our KV (+ optional verified on-chain). Never fabricated. */
app.get("/stats", async (c) => {
  const stats = await loadStats(c.env.PAYTO_HISTORY);
  const onChain = stats.onChain ?? null;
  const noteParts = [
    "KV counters from completed checks (seeded from verified history when counters started at zero).",
  ];
  if (stats.noteDetail) noteParts.push(stats.noteDetail);
  if (onChain) {
    noteParts.push(
      `paid on-chain: ${onChain.paidTransfers} Base USDC transfers to payTo ($${onChain.usdcTotal.toFixed(3)}, ${onChain.uniquePayers} wallets, asOf ${onChain.asOf}).`,
    );
  }
  return c.json(
    {
      ...stats,
      onChain,
      source: onChain ? "kv+base_usdc" : "kv",
      note: noteParts.join(" "),
      watch: {
        priceUsd: WATCH_PRICE_USD,
        durationDays: 30,
        endpoint: "/watch",
      },
    },
    200,
    {
      "Cache-Control": "public, max-age=30",
      "Access-Control-Allow-Origin": "*",
    },
  );
});

/** Free static sample — never hits sell()/KV; safe for agents that need a shape before paying. */
app.get("/example", (c) => {
  return c.json(exampleToolCheck(originOf(c), unit(c.env)), 200, {
    "Cache-Control": "public, max-age=3600",
  });
});

function unit(env: Env) {
  return unitPriceUsd(env.PRICE_PER_TOOL_USD || env.PRICE?.replace("$", ""));
}

function originOf(c: { req: { url: string } }) {
  return new URL(c.req.url).origin;
}

function cacheJson(
  c: { json: (body: unknown, status?: number, headers?: Record<string, string>) => Response },
  body: unknown,
  maxAge = 300,
) {
  return c.json(body, 200, {
    "Cache-Control": `public, max-age=${maxAge}`,
    "Access-Control-Allow-Origin": "*",
  });
}

app.get("/assets/style.css", (c) =>
  c.body(styleCss, 200, {
    "Content-Type": "text/css; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  }),
);

app.get("/assets/icon.svg", (c) =>
  c.body(ICON_SVG, 200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
    "Access-Control-Allow-Origin": "*",
  }),
);

app.get("/", async (c) => {
  const origin = originOf(c);
  const stats = await loadStats(c.env.PAYTO_HISTORY);
  const html = landingHtml(origin, unit(c.env), stats);
  return c.html(html, 200, {
    Link: `<${origin}/llms.txt>; rel="describedby", <${origin}/index.md>; rel="alternate"; type="text/markdown"`,
  });
});


app.get("/terms", (c) =>
  c.html(termsHtml(originOf(c)), 200, {
    "Cache-Control": "public, max-age=3600",
  }),
);
app.get("/privacy", (c) =>
  c.html(privacyHtml(originOf(c)), 200, {
    "Cache-Control": "public, max-age=3600",
  }),
);
app.get("/cookies", (c) =>
  c.html(cookiesHtml(originOf(c)), 200, {
    "Cache-Control": "public, max-age=3600",
  }),
);

app.get("/docs", (c) => {
  const origin = originOf(c);
  return c.html(docsHtml(origin, unit(c.env)), 200, {
    Link: `<${origin}/llms.txt>; rel="describedby", <${origin}/docs.md>; rel="alternate"; type="text/markdown"`,
  });
});

app.get("/index.md", (c) =>
  c.text(landingMarkdown(originOf(c), unit(c.env)), 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=300",
  }),
);

app.get("/docs.md", (c) =>
  c.text(docsMarkdown(originOf(c), unit(c.env)), 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=300",
  }),
);

app.get("/llms.txt", (c) =>
  c.text(llmsTxt(originOf(c), unit(c.env)), 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=300",
  }),
);

app.get("/llms-full.txt", (c) =>
  c.text(llmsFullTxt(originOf(c), unit(c.env)), 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=300",
  }),
);

app.get("/openapi.json", (c) =>
  c.json(openApiSpec(originOf(c), unit(c.env)), 200, {
    "Cache-Control": "public, max-age=300",
    "Access-Control-Allow-Origin": "*",
  }),
);

app.get("/mcp.json", (c) =>
  c.json(mcpDescriptor(originOf(c), unit(c.env)), 200, {
    "Cache-Control": "public, max-age=300",
    "Access-Control-Allow-Origin": "*",
  }),
);

app.get("/robots.txt", (c) =>
  c.text(robotsTxt(originOf(c)), 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  }),
);

app.get("/sitemap.xml", (c) => {
  const lastmod = new Date().toISOString().slice(0, 10);
  return c.body(sitemapXml(originOf(c), lastmod), 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

app.get(`/${INDEXNOW_KEY}.txt`, (c) =>
  c.text(INDEXNOW_KEY, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
  }),
);

app.get("/.well-known/agent-card.json", (c) =>
  cacheJson(c, agentCard(originOf(c), unit(c.env))),
);
app.get("/.well-known/agent.json", (c) =>
  cacheJson(c, agentJson(originOf(c), unit(c.env))),
);
app.get("/.well-known/x402", (c) =>
  cacheJson(c, x402WellKnown(originOf(c), unit(c.env))),
);
app.get("/.well-known/mcp/server-card.json", (c) =>
  cacheJson(c, mcpServerCardLegacy(originOf(c), unit(c.env))),
);
app.get("/.well-known/ai-catalog.json", (c) =>
  c.json(aiCatalog(originOf(c)), 200, {
    "Content-Type": "application/ai-catalog+json",
    "Cache-Control": "public, max-age=300",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Content-Type, If-None-Match, Accept",
  }),
);

app.get("/mcp/server-card", (c) =>
  c.json(mcpServerCardSep(originOf(c), unit(c.env)), 200, {
    "Content-Type": "application/mcp-server-card+json",
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Content-Type, If-None-Match, Accept",
    "Access-Control-Expose-Headers": "ETag",
  }),
);

app.all("/mcp", (c) => handleMcp(c));

async function maybeBypass(c: {
  env: Env;
  req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined };
}): Promise<boolean> {
  return (
    c.env.ALLOW_LOCAL_BYPASS === "true" &&
    (c.req.header("x-local-dev-bypass") === "1" || c.req.query("local_bypass") === "1")
  );
}

function paymentRoutes(env: Env, origin: string) {
  const u = unit(env);
  const priceFn = async (ctx: HTTPRequestContext) =>
    dynamicPriceForRequest(ctx, u);
  const pay = resolvePayConfig(env);
  const accepts = buildAccepts(pay, priceFn, u);

  // serviceName ≤32 printable ASCII (bazaar resource metadata rules)
  const serviceName = (env.SERVICE_NAME || "x402check").slice(0, 32);
  const tags = [
    "x402",
    "check-before-paying",
    "scam-check",
    "preflight",
    "verify-payTo",
    "agent-safety",
    "uptime",
    "budget-guard",
    "compare-tools",
    "base",
    ...(pay.solanaPayTo ? (["solana"] as const) : []),
  ];
  const iconUrl = `${origin}/assets/icon.svg`;

  const outputExample = {
    url: "https://www.api-xpay.com/x402/ping",
    verdict: "ok",
    live: true,
    priceUsd: 0.005,
    payTo: "0x589a2314a2E05F45e40C4823Da3Ba58D421dB3d8",
    reasonCodes: ["reachable", "http_402", "payto_stable"],
    history: { checks: 3, uptimePct: 100, payToChanges: [], priceChanges: [] },
  };

  // Separate GET vs POST bazaar declarations (do NOT set discoverable:true — invalid).
  // https://github.com/x402-foundation/x402/blob/main/specs/extensions/bazaar.md
  return {
    "GET /preflight": {
      description:
        `Check before paying any x402 tool: is this API a scam/safe? Trust-check one seller URL (live 402 + history). Use for verify-payTo, uptime, price/wallet drift, budget guard, validate 402, debug failing settle. Returns ok|caution|avoid + that tool's history only. $${u}/URL. No free tier. Endpoint+history — not wallet OFAC/simulation. Optional deeper signal: GET /preflight/deep ($${DEEP_CHECK_PRICE_USD}).`,
      mimeType: "application/json",
      serviceName,
      tags,
      iconUrl,
      extensions: {
        ...declareDiscoveryExtension({
          input: { url: "https://www.api-xpay.com/x402/ping" },
          inputSchema: {
            properties: {
              url: {
                type: "string",
                description: "Absolute https URL of the x402 seller to probe",
              },
              fresh: {
                type: "string",
                description: "Optional. Set 1 or true to force a live probe",
              },
            },
            required: ["url"],
          },
          output: { example: outputExample },
        }),
      },
      accepts,
    },
    "POST /preflight": {
      description:
        `Check before paying: compare/batch trust-check up to ${MAX_BATCH} seller URLs (is any a scam/unsafe; cheapest; most reliable; screen Bazaar hits). Charge $${u} × len(urls) in one Exact settlement. Returns each tool's verdict + history.`,
      mimeType: "application/json",
      serviceName,
      tags,
      iconUrl,
      extensions: {
        ...declareDiscoveryExtension({
          input: { urls: ["https://www.api-xpay.com/x402/ping"] },
          inputSchema: {
            properties: {
              urls: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
                maxItems: MAX_BATCH,
                description: "Absolute https seller URLs to check; charged per URL",
              },
              fresh: { type: "boolean" },
            },
            required: ["urls"],
          },
          bodyType: "json",
          output: {
            example: {
              results: [outputExample],
              chargedTools: 1,
              pricePerToolUsd: u,
              totalUsd: u,
            },
          },
        }),
      },
      accepts,
    },
    "GET /preflight/deep": {
      description:
        `Deep trust check ($${DEEP_CHECK_PRICE_USD} Exact USDC): everything in GET /preflight, plus repeated live probes for payTo/price consistency, recent public Base USDC transfers into the seller payTo, Bazaar + 402 Index listing samples, and drift vs last KV history. Does not claim OFAC, wallet simulation, or full chain history.`,
      mimeType: "application/json",
      serviceName,
      tags: [...tags, "deep", "on-chain-sample"],
      iconUrl,
      extensions: {
        ...declareDiscoveryExtension({
          input: { url: "https://www.api-xpay.com/x402/ping" },
          inputSchema: {
            properties: {
              url: {
                type: "string",
                description: "Absolute https URL of the x402 seller to deep-check",
              },
            },
            required: ["url"],
          },
          output: { example: { ...outputExample, deep: true, chargedUsd: DEEP_CHECK_PRICE_USD } },
        }),
      },
      accepts: [
        {
          scheme: "exact",
          price: money(DEEP_CHECK_PRICE_USD),
          network: pay.evmNetwork,
          payTo: pay.evmPayTo,
          maxTimeoutSeconds: 120,
          extra: {
            priceUsd: DEEP_CHECK_PRICE_USD,
            pricingModel: "deep_check",
            assetHint: "USDC",
            chainFamily: "evm",
            product: "deep_check",
          },
        },
      ],
    },
    "POST /watch": {
      description:
        `Watch one x402 seller URL for 30 days ($${WATCH_PRICE_USD} Exact USDC). Daily re-check; webhook and/or email on payTo/price/network/availability change. Optional after a one-shot preflight.`,
      mimeType: "application/json",
      serviceName,
      tags: [...tags, "watch", "subscription", "alert"],
      iconUrl,
      extensions: {
        ...declareDiscoveryExtension({
          input: {
            url: "https://www.api-xpay.com/x402/ping",
            webhookUrl: "https://hooks.example/x402check",
          },
          inputSchema: {
            properties: {
              url: {
                type: "string",
                description: "Absolute https URL of the x402 seller to watch",
              },
              webhookUrl: {
                type: "string",
                description: "https webhook for change alerts",
              },
              email: {
                type: "string",
                description: "Optional email for Resend alerts when RESEND_API_KEY is configured",
              },
            },
            required: ["url"],
          },
          bodyType: "json",
          output: {
            example: {
              watchId: "abc123",
              url: "https://www.api-xpay.com/x402/ping",
              expiresAt: "2026-12-01T00:00:00.000Z",
              priceUsd: WATCH_PRICE_USD,
              durationDays: 30,
            },
          },
        }),
      },
      accepts: [
        {
          scheme: "exact",
          price: money(WATCH_PRICE_USD),
          network: pay.evmNetwork,
          payTo: pay.evmPayTo,
          maxTimeoutSeconds: 120,
          extra: {
            priceUsd: WATCH_PRICE_USD,
            pricingModel: "watch_30d",
            durationDays: 30,
            assetHint: "USDC",
            chainFamily: "evm",
            product: "watch",
          },
        },
      ],
    },
    "POST /watch/renew": {
      description:
        `Renew an existing watch for another 30 days ($${WATCH_PRICE_USD} Exact USDC).`,
      mimeType: "application/json",
      serviceName,
      tags: [...tags, "watch", "renew"],
      iconUrl,
      extensions: {
        ...declareDiscoveryExtension({
          input: { watchId: "abc123" },
          inputSchema: {
            properties: {
              watchId: { type: "string", description: "Watch id from POST /watch" },
              id: { type: "string", description: "Alias of watchId" },
            },
            required: ["watchId"],
          },
          bodyType: "json",
          output: {
            example: {
              watchId: "abc123",
              expiresAt: "2026-12-31T00:00:00.000Z",
              renewed: true,
            },
          },
        }),
      },
      accepts: [
        {
          scheme: "exact",
          price: money(WATCH_PRICE_USD),
          network: pay.evmNetwork,
          payTo: pay.evmPayTo,
          maxTimeoutSeconds: 120,
          extra: {
            priceUsd: WATCH_PRICE_USD,
            pricingModel: "watch_30d",
            durationDays: 30,
            product: "watch_renew",
          },
        },
      ],
    },
  };
}

/** Shared x402 payment middleware factory for paid routes. */
async function withPayment(
  c: any,
  next: () => Promise<void>,
  routeFilter?: (methodPath: string) => boolean,
) {
  if (await maybeBypass(c)) {
    c.set("localBypass" as never, true as never);
    return next();
  }

  const facilitatorUrl =
    c.env.FACILITATOR_URL || "https://api.cdp.coinbase.com/platform/v2/x402";
  const origin = originOf(c);
  const pay = resolvePayConfig(c.env);

  const facilitatorClient = createFacilitatorClient(facilitatorUrl, {
    CDP_API_KEY_ID: c.env.CDP_API_KEY_ID,
    CDP_API_KEY_SECRET: c.env.CDP_API_KEY_SECRET,
  });
  const server = new x402ResourceServer(facilitatorClient).register(
    pay.evmNetwork,
    new ExactEvmScheme(),
  );
  if (pay.solanaPayTo && pay.solanaNetwork) {
    server.register(pay.solanaNetwork, new ExactSvmScheme());
  }
  await server.initialize();

  let routes = paymentRoutes(c.env, origin) as Record<string, unknown>;
  if (routeFilter) {
    routes = Object.fromEntries(
      Object.entries(routes).filter(([k]) => routeFilter(k)),
    );
  }

  const mw = paymentMiddleware(
    routes as any,
    server,
    undefined,
    undefined,
    false,
  );
  const out = await mw(c, next);

  const res = out instanceof Response ? out : c.res;
  if (res && res.status === 402) {
    const headers = new Headers(res.headers);
    headers.set("Content-Type", "application/json");
    headers.set("Cache-Control", "no-store");
    for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);

    let accepts: Array<Record<string, unknown>> = [];
    const pr =
      headers.get("PAYMENT-REQUIRED") || headers.get("payment-required") || "";
    if (pr) {
      try {
        const decoded = JSON.parse(atob(pr)) as { accepts?: unknown };
        if (Array.isArray(decoded.accepts)) {
          accepts = decoded.accepts.filter(
            (a): a is Record<string, unknown> =>
              !!a && typeof a === "object" && !Array.isArray(a),
          );
        }
      } catch {
        /* fall through */
      }
    }
    const path = new URL(c.req.url).pathname;
    if (!accepts.length) {
      if (path.startsWith("/watch")) {
        accepts = [
          watchAcceptRequirement(pay.evmPayTo, pay.evmNetwork, USDC_BASE_MAINNET),
        ];
      } else if (path.startsWith("/preflight/deep")) {
        accepts = [baseAcceptRequirement(pay, DEEP_CHECK_PRICE_USD)];
      } else {
        accepts = [baseAcceptRequirement(pay, unit(c.env))];
      }
    }

    let body: Record<string, unknown>;
    if (path.startsWith("/watch")) {
      body = {
        ...paymentRequiredBody(origin, WATCH_PRICE_USD, accepts),
        product: "watch",
        priceUsd: WATCH_PRICE_USD,
        durationDays: 30,
        amountAtomic: WATCH_PRICE_ATOMIC,
        note: "One Exact USDC payment buys 30 days of daily re-checks for one tool URL.",
      };
    } else if (path.startsWith("/preflight/deep")) {
      body = {
        ...paymentRequiredBody(origin, DEEP_CHECK_PRICE_USD, accepts),
        product: "deep_check",
        priceUsd: DEEP_CHECK_PRICE_USD,
        amountAtomic: DEEP_CHECK_ATOMIC,
        note: "Deep check: multi-probe + listings + recent public Base USDC-to-payTo sample + KV drift.",
      };
    } else {
      body = paymentRequiredBody(origin, unit(c.env), accepts);
    }

    return new Response(JSON.stringify(body), { status: 402, headers });
  }
  return out;
}

app.use("/preflight", async (c, next) => {
  // Exact /preflight only — deep has its own middleware
  if (new URL(c.req.url).pathname !== "/preflight") return next();
  return withPayment(c, next, (k) => k === "GET /preflight" || k === "POST /preflight");
});
app.use("/preflight/deep", async (c, next) => {
  bridgeLegacyPaymentHeader(c);
  return withPayment(c, next, (k) => k.includes("/preflight/deep"));
});

app.get("/preflight/deep", async (c) => {
  const url = c.req.query("url");
  if (!url) {
    return c.json(
      {
        error: "missing_url",
        message: "Query `url` required for deep check.",
      },
      400,
    );
  }
  if (isBlockedHost(url)) {
    return c.json(
      {
        url,
        verdict: "avoid",
        reasonCodes: ["unreachable"],
        error: "Refusing private/localhost/metadata hosts.",
      },
      400,
    );
  }
  const t0 = Date.now();
  const result = await deepCheck(url, c.env);
  const bypass =
    c.env.ALLOW_LOCAL_BYPASS === "true" &&
    (c.req.header("x-local-dev-bypass") === "1" ||
      c.req.query("local_bypass") === "1");
  await recordCheckStats(c.env.PAYTO_HISTORY, {
    verdict: result.verdict,
    paid: !bypass,
    isNewTool: result.history.checks === 1,
  });
  c.header("Server-Timing", `deep;dur=${Date.now() - t0}`);
  return c.json(result);
});



app.use("/watch/renew", async (c, next) => {
  if (c.req.method !== "POST") return next();
  return withPayment(c, next, (k) => k === "POST /watch/renew");
});

app.use("/watch", async (c, next) => {
  if (c.req.method !== "POST") return next();
  // Exact /watch only — renew has its own middleware above
  if (new URL(c.req.url).pathname !== "/watch") return next();
  return withPayment(c, next, (k) => k === "POST /watch");
});

app.get("/preflight", async (c) => {
  const url = c.req.query("url");
  if (!url) {
    return c.json(
      {
        error: "missing_url",
        message: "Query `url` required. Or POST {\"urls\":[...]} for batch.",
      },
      400,
    );
  }
  if (isBlockedHost(url)) {
    return c.json(
      {
        url,
        verdict: "avoid",
        reasonCodes: ["unreachable"],
        error: "Refusing private/localhost/metadata hosts.",
      },
      400,
    );
  }
  const forceLive = c.req.query("fresh") === "1" || c.req.query("fresh") === "true";
  const t0 = Date.now();
  const result = await checkTool(url, c.env, { forceLive });
  const bypass =
    c.env.ALLOW_LOCAL_BYPASS === "true" &&
    (c.req.header("x-local-dev-bypass") === "1" ||
      c.req.query("local_bypass") === "1");
  await recordCheckStats(c.env.PAYTO_HISTORY, {
    verdict: result.verdict,
    paid: !bypass,
    isNewTool: result.history.checks === 1,
  });
  c.header("Server-Timing", `app;dur=${Date.now() - t0}`);
  // Helpful, never pushy: one plain mention of watch
  const origin = originOf(c);
  return c.json({
    ...result,
    watchHint: watchUpsellHint(),
    deepHint: deepUpsellHint(origin),
  });
});

app.post("/preflight", async (c) => {
  let body: { urls?: unknown; url?: unknown; fresh?: unknown } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const list: string[] = [];
  if (Array.isArray(body.urls)) {
    for (const u of body.urls) if (typeof u === "string" && u.trim()) list.push(u.trim());
  } else if (typeof body.url === "string" && body.url.trim()) {
    list.push(body.url.trim());
  }
  if (!list.length) {
    return c.json({ error: "missing_urls", message: "Body must include urls: string[]" }, 400);
  }
  if (list.length > MAX_BATCH) {
    return c.json({ error: "batch_too_large", max: MAX_BATCH }, 400);
  }

  const forceLive = body.fresh === true || body.fresh === "1";
  const u = unit(c.env);
  const t0 = Date.now();
  const results: ToolCheck[] = [];
  // sequential to keep Worker subrequest fanout modest; cache keeps most under 300ms
  for (const url of list) {
    if (isBlockedHost(url)) {
      results.push({
        url,
        verdict: "avoid",
        checkedAt: new Date().toISOString(),
        live: false,
        cacheAgeMs: 0,
        status: null,
        latencyMs: null,
        is402: false,
        priceUsd: null,
        payTo: null,
        network: null,
        reasonCodes: ["unreachable"],
        history: {
          checks: 0,
          uptimePct: null,
          lastOkAt: null,
          lastFailAt: null,
          payToChanges: [],
          priceChanges: [],
          recent: [],
        },
      });
      continue;
    }
    results.push(await checkTool(url, c.env, { forceLive }));
  }

  const bypass =
    c.env.ALLOW_LOCAL_BYPASS === "true" &&
    (c.req.header("x-local-dev-bypass") === "1" ||
      c.req.query("local_bypass") === "1");
  for (const r of results) {
    await recordCheckStats(c.env.PAYTO_HISTORY, {
      verdict: r.verdict,
      paid: !bypass,
      isNewTool: r.history.checks === 1,
    });
  }

  return c.json({
    results,
    chargedTools: list.length,
    pricePerToolUsd: u,
    totalUsd: Number((list.length * u).toFixed(6)),
    elapsedMs: Date.now() - t0,
    pricingNote:
      "Exact scheme: one settlement covering N×unit for this HTTP request (not N separate txs).",
    watchHint: watchUpsellHint(),
    deepHint: deepUpsellHint(originOf(c)),
  });
});

/** Create a 30-day watch ($5 Exact). Payment middleware runs first. */
app.post("/watch", async (c) => {
  let body: { url?: unknown; webhookUrl?: unknown; email?: unknown } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const webhookUrl =
    typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : null;
  const email = typeof body.email === "string" ? body.email.trim() : null;
  const created = await createWatch(c.env, { url, webhookUrl, email });
  if (!created.ok) {
    const status = created.error === "blocked_host" || created.error === "invalid_url" ? 400 : 400;
    return c.json({ error: created.error, message: created.message }, status);
  }
  return c.json({
    watchId: created.watch.id,
    url: created.watch.url,
    expiresAt: created.watch.expiresAt,
    createdAt: created.watch.createdAt,
    priceUsd: WATCH_PRICE_USD,
    durationDays: 30,
    webhookUrl: created.watch.webhookUrl,
    email: created.watch.email,
    baseline: created.watch.baseline,
    initialCheck: created.check,
    statusUrl: `/watch?id=${created.watch.id}`,
    renewUrl: "/watch/renew",
    note: "Daily re-check for 30 days. Webhook fires on payTo/price/network/availability change.",
  });
});

/** Free watch status lookup. */
app.get("/watch", async (c) => {
  const id = (c.req.query("id") || c.req.query("watchId") || "").trim();
  if (!id) {
    return c.json(
      {
        error: "missing_id",
        message: "Query id= (watch id). To create: POST /watch {url, webhookUrl} ($5/30d).",
        priceUsd: WATCH_PRICE_USD,
        durationDays: 30,
      },
      400,
    );
  }
  const rec = await loadWatch(c.env.PAYTO_HISTORY, id);
  if (!rec) return c.json({ error: "not_found" }, 404);
  const expired = Date.parse(rec.expiresAt) < Date.now();
  return c.json({
    ...publicWatch(rec),
    expired,
    active: rec.active && !expired,
  });
});

/** Renew watch for another 30 days ($5 Exact). */
app.post("/watch/renew", async (c) => {
  let body: { watchId?: unknown; id?: unknown } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const watchId =
    (typeof body.watchId === "string" && body.watchId.trim()) ||
    (typeof body.id === "string" && body.id.trim()) ||
    "";
  if (!watchId) {
    return c.json({ error: "missing_watchId", message: "Body watchId required" }, 400);
  }
  const renewed = await renewWatch(c.env, watchId);
  if (!renewed.ok) {
    const status = renewed.error === "not_found" ? 404 : 400;
    return c.json({ error: renewed.error, message: renewed.message }, status);
  }
  return c.json({
    watchId: renewed.watch.id,
    url: renewed.watch.url,
    expiresAt: renewed.watch.expiresAt,
    renewed: true,
    priceUsd: WATCH_PRICE_USD,
    durationDays: 30,
    baseline: renewed.watch.baseline,
  });
});

app.notFound((c) => {
  if (c.req.header("accept")?.includes("text/html")) {
    return c.html(
      `<!doctype html><meta charset=utf-8><title>404</title>
       <link rel=stylesheet href="/assets/style.css">
       <main class="wrap hero"><h1>404</h1><p class="lede">Try <a href="/">home</a> or <a href="/docs">docs</a>.</p></main>`,
      404,
    );
  }
  return c.json({ error: "not_found" }, 404);
});

// silence unused import when DEFAULT_PRICE is only used via sell.ts defaults
void DEFAULT_PRICE_PER_TOOL_USD;
void WATCH_DURATION_MS;

export default {
  fetch: app.fetch,
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(
      runWatchCron(env).then((s) => {
        console.log("watch-cron", JSON.stringify(s));
      }),
    );
  },
};
