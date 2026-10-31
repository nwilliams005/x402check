/**
 * x402 Tool Trust Preflight — paid per-tool checks (no free tier for probes).
 * Production: Base mainnet + CDP. Dev: wrangler.dev.toml Sepolia.
 * Do not deploy without Nicklaus's explicit approval.
 */
import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import type { HTTPRequestContext } from "@x402/core/server";
import type { Env, ToolCheck } from "./types";
import { createFacilitatorClient } from "./facilitator";
import { checkTool, isBlockedHost } from "./preflight";
import {
  DEFAULT_PRICE_PER_TOOL_USD,
  MAX_BATCH,
  dynamicPriceForRequest,
  unitPriceUsd,
} from "./sell";
import { docsHtml, landingHtml, styleCss } from "./pages";
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
  mcpServerCardLegacy,
  mcpServerCardSep,
  paymentRequiredBody,
  robotsTxt,
  sitemapXml,
  x402WellKnown,
} from "./discovery";
import { handleMcp } from "./mcp";

const DEFAULT_PAY_TO =
  "0xd98451514c7510e3fCd0463De973B9a6bB89A86f" as `0x${string}`;

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="x402check">
  <rect width="128" height="128" rx="28" fill="#070b12"/>
  <rect x="10" y="10" width="108" height="108" rx="22" fill="#0e1520" stroke="#1e2a3a" stroke-width="4"/>
  <path d="M36 66l18 18 38-42" fill="none" stroke="#7dd3a7" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const app = new Hono<{ Bindings: Env }>();

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

app.get("/", (c) => {
  const origin = originOf(c);
  const html = landingHtml(origin, unit(c.env));
  return c.html(html, 200, {
    Link: `<${origin}/llms.txt>; rel="describedby", <${origin}/index.md>; rel="alternate"; type="text/markdown"`,
  });
});

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

function paymentRoutes(env: Env, payTo: `0x${string}`, network: `${string}:${string}`, origin: string) {
  const u = unit(env);
  const priceFn = async (ctx: HTTPRequestContext) =>
    dynamicPriceForRequest(ctx, u);

  // serviceName ≤32 printable ASCII (bazaar resource metadata rules)
  const serviceName = (env.SERVICE_NAME || "x402check").slice(0, 32);
  const tags = ["x402", "trust", "preflight", "agent-safety", "verify-payTo"];
  const iconUrl = `${origin}/assets/icon.svg`;

  const accepts = {
    scheme: "exact",
    price: priceFn,
    network,
    payTo,
    maxTimeoutSeconds: 60,
    extra: {
      pricePerToolUsd: u,
      pricingModel: "per_tool",
      batchNote:
        "POST body urls[] → DynamicPrice = N×unit in ONE Exact settlement (not N separate txs).",
    },
  };

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
        "Before paying any x402 tool: trust-check one seller URL. Answers is-this-x402-endpoint-safe / verify-payTo. Returns ok|caution|avoid + that tool's history only. No free tier.",
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
      accepts: [accepts],
    },
    "POST /preflight": {
      description:
        `Before paying: batch trust-check up to ${MAX_BATCH} seller URLs. Charge $${u} × len(urls) in one Exact settlement. Returns each tool's verdict + history.`,
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
      accepts: [accepts],
    },
  };
}

app.use("/preflight", async (c, next) => {
  if (await maybeBypass(c)) {
    c.set("localBypass" as never, true as never);
    return next();
  }

  const payTo = (c.env.PAY_TO || DEFAULT_PAY_TO) as `0x${string}`;
  const network = (c.env.NETWORK || "eip155:8453") as `${string}:${string}`;
  const facilitatorUrl =
    c.env.FACILITATOR_URL || "https://api.cdp.coinbase.com/platform/v2/x402";
  const origin = originOf(c);

  const facilitatorClient = createFacilitatorClient(facilitatorUrl, {
    CDP_API_KEY_ID: c.env.CDP_API_KEY_ID,
    CDP_API_KEY_SECRET: c.env.CDP_API_KEY_SECRET,
  });
  const server = new x402ResourceServer(facilitatorClient).register(
    network,
    new ExactEvmScheme(),
  );
  await server.initialize();

  const mw = paymentMiddleware(
    paymentRoutes(c.env, payTo, network, origin),
    server,
    undefined,
    undefined,
    false,
  );
  const out = await mw(c, next);

  // Enrich bare 402 JSON bodies so agents know exactly how to pay.
  // Keep PAYMENT-REQUIRED / other headers from the middleware.
  const res = out instanceof Response ? out : c.res;
  if (res && res.status === 402) {
    const headers = new Headers(res.headers);
    headers.set("Content-Type", "application/json");
    headers.set("Cache-Control", "no-store");
    return new Response(JSON.stringify(paymentRequiredBody(origin, unit(c.env))), {
      status: 402,
      headers,
    });
  }
  return out;
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
  c.header("Server-Timing", `app;dur=${Date.now() - t0}`);
  return c.json(result);
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

  return c.json({
    results,
    chargedTools: list.length,
    pricePerToolUsd: u,
    totalUsd: Number((list.length * u).toFixed(6)),
    elapsedMs: Date.now() - t0,
    pricingNote:
      "Exact scheme: one settlement covering N×unit for this HTTP request (not N separate txs).",
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

export default app;
