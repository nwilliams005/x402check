#!/usr/bin/env node
/**
 * Local integration checks against wrangler dev (port 8787).
 * Read-only GETs to public x402 sellers. Never pays anyone.
 * Uses local_bypass (dev only) so we don't need real USDC.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8787";
const WRANGLER_CACHE_DIR = process.env.WRANGLER_CACHE_DIR || "/tmp/wcache";
const INDEXNOW_KEY = "32f90a760723b12a25ff3e310dbfd64a";

const TARGETS = [
  "https://www.api-xpay.com/x402/ping",
  "https://blockrun.ai/api/v1/chat/completions",
  "https://agent.pocket.network/v1/meadow",
  "https://keyring-agent.blockchhub.link/api/send-native",
  "https://www.api-xpay.com/x402/quote",
];

function encode(url) {
  return encodeURIComponent(url);
}

async function waitForServer(ms = 60_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(`${BASE}/llms.txt`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error(`Server not up at ${BASE} within ${ms}ms`);
}

async function main() {
  const startedByUs = process.env.EXTERNAL_SERVER !== "1";
  let child;
  if (startedByUs) {
    child = spawn(
      "npx",
      [
        "wrangler",
        "dev",
        "--config",
        "wrangler.dev.toml",
        "--local",
        "--port",
        "8787",
        "--ip",
        "127.0.0.1",
      ],
      {
        cwd: new URL("..", import.meta.url).pathname,
        env: { ...process.env, WRANGLER_CACHE_DIR },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout.on("data", (d) => process.stdout.write(`[wrangler] ${d}`));
    child.stderr.on("data", (d) => process.stderr.write(`[wrangler] ${d}`));
  }

  const results = [];
  try {
    await waitForServer();

    const discoveryPaths = [
      "/",
      "/docs",
      "/example",
      "/stats",
      "/index.md",
      "/docs.md",
      "/llms.txt",
      "/llms-full.txt",
      "/openapi.json",
      "/mcp.json",
      "/mcp/server-card",
      "/robots.txt",
      "/sitemap.xml",
      "/assets/style.css",
      "/assets/icon.svg",
      `/${INDEXNOW_KEY}.txt`,
      "/.well-known/agent-card.json",
      "/.well-known/agent.json",
      "/.well-known/x402",
      "/.well-known/mcp/server-card.json",
      "/.well-known/ai-catalog.json",
    ];
    for (const path of discoveryPaths) {
      const r = await fetch(`${BASE}${path}`);
      results.push({ test: `GET ${path}`, status: r.status, ok: r.status === 200 });
    }

    // robots.txt must Allow AI crawlers and advertise sitemap
    {
      const r = await fetch(`${BASE}/robots.txt`);
      const text = await r.text();
      results.push({
        test: "robots.txt AI + sitemap",
        status: r.status,
        ok:
          r.status === 200 &&
          text.includes("Sitemap:") &&
          text.includes("GPTBot") &&
          text.includes("ClaudeBot") &&
          text.includes("Allow: /") &&
          !text.includes("Disallow: /"),
      });
    }

    // sitemap must include key discovery URLs
    {
      const r = await fetch(`${BASE}/sitemap.xml`);
      const text = await r.text();
      results.push({
        test: "sitemap.xml coverage",
        status: r.status,
        ok:
          r.status === 200 &&
          text.includes("/llms.txt") &&
          text.includes("/openapi.json") &&
          text.includes("/mcp/server-card") &&
          text.includes("/.well-known/ai-catalog.json"),
      });
    }

    // landing must have OG + JSON-LD + canonical
    {
      const r = await fetch(`${BASE}/`);
      const html = await r.text();
      results.push({
        test: "landing SEO (og/canonical/json-ld)",
        status: r.status,
        ok:
          r.status === 200 &&
          html.includes('rel="canonical"') &&
          html.includes("og:title") &&
          html.includes("application/ld+json") &&
          html.includes("FAQPage") &&
          html.includes("is this x402 endpoint safe"),
      });
    }

    // llms.txt must cover when-to-use intents
    {
      const r = await fetch(`${BASE}/llms.txt`);
      const text = await r.text();
      results.push({
        test: "llms.txt when-to-use",
        status: r.status,
        ok:
          r.status === 200 &&
          /when to use x402check/i.test(text) &&
          /verify payTo/i.test(text) &&
          text.includes("Budget guard") &&
          text.includes("verify_payto") &&
          text.includes("compare_tools"),
      });
    }

    // OpenAPI must advertise x-guidance + x-payment-info for x402scan
    {
      const r = await fetch(`${BASE}/openapi.json`);
      const spec = await r.json();
      const getOp = spec?.paths?.["/preflight"]?.get;
      results.push({
        test: "openapi agent fields",
        status: r.status,
        ok:
          r.status === 200 &&
          typeof spec?.info?.["x-guidance"] === "string" &&
          getOp?.operationId === "preflightCheck" &&
          Boolean(getOp?.["x-payment-info"]) &&
          Boolean(getOp?.responses?.["402"]) &&
          Boolean(spec?.paths?.["/llms-full.txt"]) &&
          Boolean(spec?.paths?.["/mcp/server-card"]) &&
          Boolean(spec?.paths?.["/.well-known/ai-catalog.json"]),
      });
    }

    // x402 well-known: version 1 + resources as URL strings
    {
      const r = await fetch(`${BASE}/.well-known/x402`);
      const body = await r.json();
      results.push({
        test: "x402 well-known canonical",
        status: r.status,
        ok:
          r.status === 200 &&
          body?.version === 1 &&
          Array.isArray(body?.resources) &&
          typeof body.resources[0] === "string" &&
          body.resources[0].includes("/preflight"),
      });
    }

    // SEP-2127 MCP server card content-type + remotes
    {
      const r = await fetch(`${BASE}/mcp/server-card`);
      const ct = r.headers.get("content-type") || "";
      const body = await r.json();
      results.push({
        test: "mcp/server-card SEP-2127",
        status: r.status,
        ok:
          r.status === 200 &&
          ct.includes("mcp-server-card") &&
          body?.name === "dev.x402check/mcp" &&
          Array.isArray(body?.remotes) &&
          body.remotes[0]?.type === "streamable-http",
      });
    }

    // AI Catalog
    {
      const r = await fetch(`${BASE}/.well-known/ai-catalog.json`);
      const body = await r.json();
      results.push({
        test: "ai-catalog.json",
        status: r.status,
        ok:
          r.status === 200 &&
          body?.specVersion === "1.0" &&
          Array.isArray(body?.entries) &&
          body.entries.some((e) => e.type === "application/mcp-server-card+json"),
      });
    }

    // IndexNow key file
    {
      const r = await fetch(`${BASE}/${INDEXNOW_KEY}.txt`);
      const text = (await r.text()).trim();
      results.push({
        test: "IndexNow key file",
        status: r.status,
        ok: r.status === 200 && text === INDEXNOW_KEY,
      });
    }

    // MCP initialize + tools/list (free)
    {
      const r = await fetch(`${BASE}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {},
        }),
      });
      const body = await r.json();
      results.push({
        test: "MCP initialize",
        status: r.status,
        ok: r.status === 200 && body?.result?.serverInfo?.name === "x402check",
      });
    }
    {
      const r = await fetch(`${BASE}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      });
      const body = await r.json();
      const names = (body?.result?.tools || []).map((t) => t.name);
      results.push({
        test: "MCP tools/list",
        status: r.status,
        ok:
          r.status === 200 &&
          names.includes("preflight_check") &&
          names.includes("preflight_batch") &&
          names.includes("verify_payto") &&
          names.includes("compare_tools"),
        tools: names,
      });
    }

    // Unpaid MCP tools/call → PaymentRequired (transports-v2/mcp.md)
    {
      const r = await fetch(`${BASE}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "preflight_check",
            arguments: { url: TARGETS[0] },
          },
        }),
      });
      const body = await r.json();
      const result = body?.result;
      const sc = result?.structuredContent;
      const textJson = result?.content?.[0]?.text;
      let parsed = null;
      try {
        parsed = textJson ? JSON.parse(textJson) : null;
      } catch {
        parsed = null;
      }
      const accepts = Array.isArray(sc?.accepts) ? sc.accepts : [];
      const baseAccept = accepts.find(
        (a) => a?.scheme === "exact" && String(a?.network || "").startsWith("eip155:"),
      );
      results.push({
        test: "MCP unpaid tools/call → PaymentRequired + accepts",
        status: r.status,
        ok:
          r.status === 200 &&
          body?.jsonrpc === "2.0" &&
          result?.isError === true &&
          sc?.x402Version === 2 &&
          Array.isArray(sc?.accepts) &&
          sc.accepts.length >= 1 &&
          Boolean(baseAccept) &&
          typeof baseAccept.payTo === "string" &&
          baseAccept.payTo.startsWith("0x") &&
          sc?.resource?.url === "mcp://tool/preflight_check" &&
          parsed?.x402Version === 2 &&
          Array.isArray(parsed?.accepts),
        accepts: accepts.length,
        resource: sc?.resource?.url,
        error: sc?.error,
      });
    }

    // Unpaid /preflight → 402 with howToPay body
    {
      let ok = false;
      let status = 0;
      let hasPr = false;
      let hasHowTo = false;
      for (let i = 0; i < 4; i++) {
        const r = await fetch(`${BASE}/preflight?url=${encode(TARGETS[0])}`);
        status = r.status;
        const pr = r.headers.get("payment-required") || r.headers.get("PAYMENT-REQUIRED");
        hasPr = Boolean(pr);
        let body = null;
        try {
          body = await r.json();
        } catch {
          body = null;
        }
        hasHowTo = Boolean(body?.howToPay?.steps);
        if (status === 402 && hasHowTo) {
          ok = true;
          break;
        }
        await sleep(1500);
      }
      let hasV2 = false;
      let hasSample = false;
      let hasCors = false;
      if (ok) {
        const r2 = await fetch(`${BASE}/preflight?url=${encode(TARGETS[0])}`);
        hasCors = (r2.headers.get("access-control-allow-origin") || "") === "*";
        hasCors =
          hasCors &&
          (r2.headers.get("access-control-expose-headers") || "")
            .toLowerCase()
            .includes("payment-required");
        try {
          const b2 = await r2.json();
          hasV2 = b2?.x402Version === 2 && Boolean(b2?.howToPay?.legacyNote);
          hasSample = typeof b2?.howToPay?.sampleResponse === "string";
        } catch {
          /* ignore */
        }
      }
      results.push({
        test: "unpaid /preflight → 402 + howToPay",
        status,
        ok: ok && hasV2 && hasSample,
        hasPaymentRequired: hasPr,
        hasHowToPay: hasHowTo,
        hasV2,
        hasSample,
      });
      results.push({
        test: "402 CORS expose PAYMENT-REQUIRED",
        status,
        ok: ok && hasCors,
        hasCors,
      });
    }

    // Base-only accepts in header + JSON body (x402dash requires body.accepts[])
    {
      const r = await fetch(`${BASE}/preflight?url=${encode(TARGETS[0])}`);
      const pr =
        r.headers.get("payment-required") || r.headers.get("PAYMENT-REQUIRED");
      let headerNetworks = [];
      let bodyAccepts = [];
      let body = null;
      try {
        body = await r.json();
        bodyAccepts = Array.isArray(body?.accepts) ? body.accepts : [];
      } catch {
        /* ignore */
      }
      if (pr) {
        try {
          const raw = Buffer.from(pr, "base64").toString("utf8");
          const decoded = JSON.parse(raw);
          const accepts = decoded?.accepts || decoded?.paymentRequirements || [];
          headerNetworks = (Array.isArray(accepts) ? accepts : []).map(
            (a) => a.network,
          );
        } catch {
          /* ignore */
        }
      }
      const bodyNetworks = bodyAccepts.map((a) => a?.network);
      const hasBaseHeader = headerNetworks.some((n) =>
        String(n).startsWith("eip155:"),
      );
      const hasBaseBody = bodyNetworks.some((n) =>
        String(n).startsWith("eip155:"),
      );
      const hasSolHeader = headerNetworks.some((n) =>
        String(n).startsWith("solana:"),
      );
      const hasSolBody = bodyNetworks.some((n) =>
        String(n).startsWith("solana:"),
      );
      results.push({
        test: "402 body+header accepts Base only",
        status: r.status,
        ok:
          r.status === 402 &&
          bodyAccepts.length >= 1 &&
          hasBaseHeader &&
          hasBaseBody &&
          !hasSolHeader &&
          !hasSolBody &&
          typeof bodyAccepts[0]?.payTo === "string" &&
          typeof bodyAccepts[0]?.amount === "string",
        headerNetworks,
        bodyNetworks,
        bodyAcceptsLen: bodyAccepts.length,
      });
    }

    // Discovery docs: Base advertised; Solana not claimed as live payment
    {
      const r = await fetch(`${BASE}/llms.txt`);
      const text = await r.text();
      results.push({
        test: "llms.txt Base-only (no Solana payment claim)",
        status: r.status,
        ok:
          r.status === 200 &&
          /eip155:8453|Base/i.test(text) &&
          !/solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/i.test(text),
      });
    }
    {
      const r = await fetch(`${BASE}/openapi.json`);
      const spec = await r.json();
      const nets = spec?.info?.["x-x402"]?.networks || [];
      const protocols =
        spec?.paths?.["/preflight"]?.get?.["x-payment-info"]?.protocols || [];
      const protoNets = protocols.map((p) => p?.x402?.network).filter(Boolean);
      results.push({
        test: "openapi lists Base only (no Solana)",
        status: r.status,
        ok:
          r.status === 200 &&
          nets.some((n) => String(n).startsWith("eip155:")) &&
          !nets.some((n) => String(n).startsWith("solana:")) &&
          protoNets.some((n) => String(n).startsWith("eip155:")) &&
          !protoNets.some((n) => String(n).startsWith("solana:")),
        networks: nets,
        protocolNetworks: protoNets,
      });
    }
    {
      const r = await fetch(`${BASE}/.well-known/x402`);
      const body = await r.json();
      const s = JSON.stringify(body);
      results.push({
        test: "x402 well-known Base-only",
        status: r.status,
        ok:
          r.status === 200 &&
          /eip155:8453|Base/i.test(s) &&
          !/solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/i.test(s),
      });
    }

    // OPTIONS preflight (CORS)
    {
      const r = await fetch(`${BASE}/preflight`, { method: "OPTIONS" });
      const allow = (r.headers.get("access-control-allow-headers") || "").toLowerCase();
      results.push({
        test: "OPTIONS /preflight CORS",
        status: r.status,
        ok:
          (r.status === 204 || r.status === 200) &&
          r.headers.get("access-control-allow-origin") === "*" &&
          allow.includes("payment-signature"),
      });
    }

    // Free static example
    {
      const r = await fetch(`${BASE}/example`);
      let body = null;
      try {
        body = await r.json();
      } catch {
        body = null;
      }
      results.push({
        test: "GET /example free sample",
        status: r.status,
        ok:
          r.status === 200 &&
          body?.sample === true &&
          body?.result?.verdict === "ok" &&
          typeof body?.result?.history?.checks === "number",
      });
    }

    // sitemap includes /example
    {
      const r = await fetch(`${BASE}/sitemap.xml`);
      const text = await r.text();
      results.push({
        test: "sitemap includes /example",
        status: r.status,
        ok: r.status === 200 && text.includes("/example"),
      });
    }

    {
      const r = await fetch(`${BASE}/preflight?local_bypass=1`);
      results.push({ test: "missing url → 400", status: r.status, ok: r.status === 400 });
    }

    for (const target of TARGETS) {
      const r = await fetch(
        `${BASE}/preflight?local_bypass=1&fresh=1&url=${encode(target)}`,
      );
      let body = null;
      try {
        body = await r.json();
      } catch {
        body = null;
      }
      const compact =
        r.status === 200 &&
        typeof body?.verdict === "string" &&
        body?.history &&
        typeof body.history.checks === "number" &&
        Array.isArray(body.reasonCodes);
      results.push({
        test: `probe ${target}`,
        status: r.status,
        ok: compact,
        verdict: body?.verdict,
        live: body?.live,
        checks: body?.history?.checks,
        payTo: body?.payTo,
        reasonCodes: body?.reasonCodes,
      });
    }

    // Cached second sighting should be fast + history.checks >= 1
    {
      const target = TARGETS[0];
      const t0 = Date.now();
      const r = await fetch(
        `${BASE}/preflight?local_bypass=1&url=${encode(target)}`,
      );
      const ms = Date.now() - t0;
      const body = await r.json();
      results.push({
        test: "cache/history second sighting",
        status: r.status,
        ok:
          r.status === 200 &&
          body?.history?.checks >= 1 &&
          (body.live === false || body.history.checks >= 1),
        live: body?.live,
        cacheAgeMs: body?.cacheAgeMs,
        elapsedMs: ms,
        checks: body?.history?.checks,
      });
    }

    // Batch POST
    {
      const r = await fetch(`${BASE}/preflight?local_bypass=1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls: TARGETS.slice(0, 2), fresh: false }),
      });
      const body = await r.json();
      results.push({
        test: "POST batch /preflight",
        status: r.status,
        ok:
          r.status === 200 &&
          Array.isArray(body?.results) &&
          body.results.length === 2 &&
          body.chargedTools === 2 &&
          typeof body.pricePerToolUsd === "number",
        chargedTools: body?.chargedTools,
        totalUsd: body?.totalUsd,
      });
    }

    // Live stats (honest counts after probes above)
    {
      const r = await fetch(`${BASE}/stats`);
      const body = await r.json();
      results.push({
        test: "GET /stats real counters",
        status: r.status,
        ok:
          r.status === 200 &&
          typeof body?.totalChecks === "number" &&
          body.totalChecks >= 1 &&
          typeof body?.paidChecks === "number" &&
          typeof body?.toolsChecked === "number" &&
          body?.watch?.priceUsd === 5 &&
          body?.source === "kv",
        totalChecks: body?.totalChecks,
        paidChecks: body?.paidChecks,
      });
    }

    // Landing includes Live stats
    {
      const r = await fetch(`${BASE}/`);
      const html = await r.text();
      results.push({
        test: "landing shows Live stats",
        status: r.status,
        ok: r.status === 200 && html.includes("Live stats") && html.includes("/stats"),
      });
    }


    // Unpaid GET /preflight → 402 at $0.01 (10000 atomic)
    {
      const r = await fetch(`${BASE}/preflight?url=${encode(TARGETS[0])}`);
      const body = await r.json().catch(() => ({}));
      const pr = r.headers.get("PAYMENT-REQUIRED") || r.headers.get("payment-required") || "";
      let amountOk =
        body?.howToPay?.amountAtomicUsdc === "10000" ||
        body?.howToPay?.pricePerToolUsd === 0.01;
      if (pr) {
        try {
          const decoded = JSON.parse(Buffer.from(pr, "base64").toString("utf8"));
          const accepts = decoded?.accepts || [];
          amountOk =
            amountOk ||
            accepts.some(
              (a) => String(a.amount) === "10000" || String(a.maxAmountRequired) === "10000",
            );
        } catch {
          try {
            const decoded = JSON.parse(pr);
            const accepts = decoded?.accepts || [];
            amountOk =
              amountOk ||
              accepts.some((a) => String(a.amount) === "10000");
          } catch { /* ignore */ }
        }
      }
      const acceptsBody = body?.accepts || [];
      amountOk =
        amountOk ||
        acceptsBody.some((a) => String(a.amount) === "10000");
      results.push({
        test: "unpaid GET /preflight → 402 $0.01",
        status: r.status,
        ok: r.status === 402 && amountOk,
        amountAtomicUsdc: body?.howToPay?.amountAtomicUsdc,
        pricePerToolUsd: body?.howToPay?.pricePerToolUsd,
      });
    }

    // Unpaid GET /preflight/deep → 402 at $0.05 (50000 atomic)
    {
      const r = await fetch(`${BASE}/preflight/deep?url=${encode(TARGETS[0])}`);
      const body = await r.json().catch(() => ({}));
      const pr = r.headers.get("PAYMENT-REQUIRED") || r.headers.get("payment-required") || "";
      let amountOk =
        body?.amountAtomic === "50000" ||
        body?.priceUsd === 0.05 ||
        body?.howToPay?.amountAtomicUsdc === "50000";
      if (pr) {
        try {
          const decoded = JSON.parse(Buffer.from(pr, "base64").toString("utf8"));
          const accepts = decoded?.accepts || [];
          amountOk =
            amountOk ||
            accepts.some(
              (a) => String(a.amount) === "50000" || String(a.maxAmountRequired) === "50000",
            );
        } catch {
          try {
            const decoded = JSON.parse(pr);
            const accepts = decoded?.accepts || [];
            amountOk =
              amountOk ||
              accepts.some((a) => String(a.amount) === "50000");
          } catch { /* ignore */ }
        }
      }
      const acceptsBody = body?.accepts || [];
      amountOk =
        amountOk ||
        acceptsBody.some((a) => String(a.amount) === "50000");
      results.push({
        test: "unpaid GET /preflight/deep → 402 $0.05",
        status: r.status,
        ok: r.status === 402 && amountOk,
        priceUsd: body?.priceUsd,
        amountAtomic: body?.amountAtomic,
        product: body?.product,
      });
    }

    // Bypass deep check shape
    {
      const r = await fetch(
        `${BASE}/preflight/deep?local_bypass=1&url=${encode(TARGETS[0])}`,
      );
      const body = await r.json().catch(() => ({}));
      results.push({
        test: "bypass GET /preflight/deep shape",
        status: r.status,
        ok:
          r.status === 200 &&
          body?.deep === true &&
          body?.chargedUsd === 0.05 &&
          body?.priceConsistency &&
          body?.onChainPayTo &&
          body?.listings &&
          body?.driftVsLast &&
          typeof body?.watchHint === "string",
        verdict: body?.verdict,
        deep: body?.deep,
      });
    }

    // Unpaid POST /watch → 402 with $5 (5000000)
    {
      const r = await fetch(`${BASE}/watch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: TARGETS[0],
          webhookUrl: "https://hooks.example.com/x402check",
        }),
      });
      const body = await r.json().catch(() => ({}));
      const pr = r.headers.get("PAYMENT-REQUIRED") || r.headers.get("payment-required") || "";
      let amountOk = body?.amountAtomic === "5000000" || body?.priceUsd === 5;
      if (pr) {
        try {
          const decoded = JSON.parse(Buffer.from(pr, "base64").toString("utf8"));
          const accepts = decoded?.accepts || [];
          amountOk =
            amountOk ||
            accepts.some(
              (a) => String(a.amount) === "5000000" || String(a.maxAmountRequired) === "5000000",
            );
        } catch {
          /* header may be raw json in some paths */
          try {
            const decoded = JSON.parse(pr);
            const accepts = decoded?.accepts || [];
            amountOk =
              amountOk ||
              accepts.some((a) => String(a.amount) === "5000000");
          } catch { /* ignore */ }
        }
      }
      const acceptsBody = body?.accepts || [];
      amountOk =
        amountOk ||
        acceptsBody.some((a) => String(a.amount) === "5000000");
      results.push({
        test: "unpaid POST /watch → 402 $5",
        status: r.status,
        ok: r.status === 402 && amountOk,
        priceUsd: body?.priceUsd,
        amountAtomic: body?.amountAtomic,
      });
    }

    // Free GET /watch without id → 400 with price hint
    {
      const r = await fetch(`${BASE}/watch`);
      const body = await r.json();
      results.push({
        test: "GET /watch missing id → 400",
        status: r.status,
        ok: r.status === 400 && body?.priceUsd === 5,
      });
    }

    // llms.txt mentions /stats and watch
    {
      const r = await fetch(`${BASE}/llms.txt`);
      const text = await r.text();
      results.push({
        test: "llms.txt mentions stats + watch",
        status: r.status,
        ok:
          r.status === 200 &&
          text.includes("/stats") &&
          text.includes("/watch") &&
          text.includes("watch_tool") &&
          text.includes("deep_check") &&
          text.includes("/preflight/deep"),
      });
    }

    // OpenAPI has /stats and /watch
    {
      const r = await fetch(`${BASE}/openapi.json`);
      const spec = await r.json();
      results.push({
        test: "openapi has /stats, /preflight/deep, and /watch",
        status: r.status,
        ok:
          r.status === 200 &&
          !!spec?.paths?.["/stats"] &&
          !!spec?.paths?.["/preflight/deep"]?.get &&
          !!spec?.paths?.["/watch"]?.post &&
          !!spec?.paths?.["/watch/renew"],
      });
    }
  } finally {
    if (child) {
      child.kill("SIGTERM");
      await sleep(500);
    }
  }

  console.log("\n=== TEST RESULTS ===");
  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`\n${failed.length} test(s) failed`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} checks passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
