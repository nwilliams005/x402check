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
