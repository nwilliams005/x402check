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
      "/llms.txt",
      "/openapi.json",
      "/mcp.json",
      "/robots.txt",
      "/assets/style.css",
      "/.well-known/agent-card.json",
      "/.well-known/agent.json",
      "/.well-known/x402",
      "/.well-known/mcp/server-card.json",
    ];
    for (const path of discoveryPaths) {
      const r = await fetch(`${BASE}${path}`);
      results.push({ test: `GET ${path}`, status: r.status, ok: r.status === 200 });
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
          Boolean(getOp?.responses?.["402"]),
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
          names.includes("preflight_batch"),
        tools: names,
      });
    }

    // Unpaid /preflight → 402 (retry once on facilitator flake)
    {
      let ok = false;
      let status = 0;
      let hasPr = false;
      for (let i = 0; i < 4; i++) {
        const r = await fetch(`${BASE}/preflight?url=${encode(TARGETS[0])}`);
        status = r.status;
        const pr = r.headers.get("payment-required") || r.headers.get("PAYMENT-REQUIRED");
        hasPr = Boolean(pr);
        if (status === 402) {
          ok = true;
          break;
        }
        await sleep(1500);
      }
      results.push({
        test: "unpaid /preflight → 402",
        status,
        ok,
        hasPaymentRequired: hasPr,
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
