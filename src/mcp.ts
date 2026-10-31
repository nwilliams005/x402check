/**
 * Minimal Streamable-HTTP MCP JSON-RPC surface for discovery + tool proxy.
 * tools/list is free. tools/call proxies to /preflight (caller must satisfy x402
 * on that HTTP path, or use local_bypass in dev).
 *
 * Alias tools (verify_payto, compare_tools) map onto the same billing: per URL.
 */
import type { Context } from "hono";
import type { Env } from "./types";
import { checkTool, isBlockedHost } from "./preflight";
import { MAX_BATCH, unitPriceUsd } from "./sell";
import type { ToolCheck } from "./types";

type JsonRpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function unit(env: Env) {
  return unitPriceUsd(env.PRICE_PER_TOOL_USD || env.PRICE?.replace("$", ""));
}

function ok(id: JsonRpc["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function err(id: JsonRpc["id"], code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, data } };
}

const URL_PROP = {
  type: "string",
  description:
    "Absolute https URL of the x402 seller endpoint (the resource you are about to pay)",
};

function toolList(price: number) {
  return {
    tools: [
      {
        name: "preflight_check",
        description:
          "Mandatory trust preflight before paying any x402 endpoint. Pass the absolute https seller URL. Returns verdict ok|caution|avoid plus that tool's history only (uptime, payToChanges, priceChanges). Use when: about to settle / PAYMENT-SIGNATURE; asking if an endpoint is safe or legit; debugging a failing 402; checking uptime; validating payment requirements before signing USDC on Base. Do not pay if verdict=avoid. Charged $" +
          price +
          " per URL via x402 on GET /preflight.",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: URL_PROP,
            fresh: {
              type: "boolean",
              description: "Force a live probe; ignore cache",
            },
          },
        },
        annotations: {
          title: "x402 endpoint trust preflight",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
        _meta: { pricePerToolUsd: price, billsAs: "per_url" },
      },
      {
        name: "verify_payto",
        description:
          "Verify the payTo / receiving wallet an x402 seller demands before you sign. Same check as preflight_check: live 402 probe + history.payToChanges (wallet rotations) and priceChanges. Use when confirming which Base USDC address you will pay, comparing payTo to an allowlist, or detecting a rug-style wallet swap. Charged per URL.",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: URL_PROP,
            fresh: {
              type: "boolean",
              description: "Force a live probe; ignore cache",
            },
          },
        },
        annotations: {
          title: "Verify x402 payTo address",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
        _meta: {
          pricePerToolUsd: price,
          billsAs: "per_url",
          aliasOf: "preflight_check",
        },
      },
      {
        name: "preflight_batch",
        description:
          "Trust-check up to 25 x402 seller URLs in one request. Charged per URL (N × unit) in a single Exact settlement. Prefer when comparing candidates, picking the cheapest/most reliable, or screening Bazaar search hits before paying any of them.",
        inputSchema: {
          type: "object",
          required: ["urls"],
          properties: {
            urls: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 25,
              description: "Absolute https seller URLs; billed per item",
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
        _meta: { pricePerToolUsd: price, billsAs: "per_url" },
      },
      {
        name: "compare_tools",
        description:
          "Compare several x402 tools before choosing which to pay. Alias of preflight_batch: returns each URL's verdict, priceUsd, payTo, uptimePct, and drift history so you can pick reliable/cheap candidates and skip avoid. Charged per URL.",
        inputSchema: {
          type: "object",
          required: ["urls"],
          properties: {
            urls: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 25,
              description: "Candidate seller URLs to compare",
            },
            fresh: { type: "boolean" },
          },
        },
        annotations: {
          title: "Compare x402 seller tools",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
        _meta: {
          pricePerToolUsd: price,
          billsAs: "per_url",
          aliasOf: "preflight_batch",
        },
      },
    ],
  };
}

function emptyAvoid(url: string): ToolCheck {
  return {
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
  };
}

async function runOne(
  url: string,
  env: Env,
  fresh: boolean,
): Promise<ToolCheck> {
  if (isBlockedHost(url)) return emptyAvoid(url);
  return checkTool(url, env, { forceLive: fresh });
}

async function runBatch(
  list: string[],
  env: Env,
  fresh: boolean,
  price: number,
) {
  const results: ToolCheck[] = [];
  for (const url of list) {
    results.push(await runOne(url, env, fresh));
  }
  return {
    results,
    chargedTools: list.length,
    pricePerToolUsd: price,
    totalUsd: Number((list.length * price).toFixed(6)),
  };
}

export async function handleMcp(c: Context<{ Bindings: Env }>) {
  if (c.req.method === "GET") {
    return c.json({
      name: "x402check",
      transport: "streamable-http",
      hint: "POST JSON-RPC: initialize | tools/list | tools/call",
      descriptor: "/mcp.json",
      serverCard: "/.well-known/mcp/server-card.json",
      tools: [
        "preflight_check",
        "verify_payto",
        "preflight_batch",
        "compare_tools",
      ],
    });
  }

  let body: JsonRpc;
  try {
    body = await c.req.json();
  } catch {
    return c.json(err(null, -32700, "Parse error"), 400);
  }

  const method = body.method || "";
  const id = body.id ?? null;
  const price = unit(c.env);

  if (method === "initialize") {
    return c.json(
      ok(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: {
          name: "x402check",
          version: "0.2.2",
        },
        instructions:
          `Before any x402 payment, call preflight_check (or verify_payto). To compare sellers, call compare_tools / preflight_batch. Unit $${price}/URL. Deny pay when verdict=avoid; escalate on caution; still enforce maxAmount on ok. We probe the endpoint's live 402 + history (not wallet OFAC/simulation).`,
      }),
    );
  }

  if (method === "notifications/initialized" || method === "ping") {
    return c.body(null, 204);
  }

  if (method === "tools/list") {
    return c.json(ok(id, toolList(price)));
  }

  if (method === "tools/call") {
    const params = body.params || {};
    const name = String(params.name || "");
    const args = (params.arguments || {}) as Record<string, unknown>;

    const bypass =
      c.env.ALLOW_LOCAL_BYPASS === "true" &&
      (c.req.header("x-local-dev-bypass") === "1" ||
        c.req.query("local_bypass") === "1");

    if (!bypass) {
      return c.json(
        ok(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "payment_required",
                message:
                  "Pay via x402 Exact on HTTP GET/POST /preflight (PAYMENT-SIGNATURE), or use x402check-client. MCP tools/call does not settle payment itself. Billing is per tool URL checked.",
                http: {
                  get: "/preflight?url=",
                  post: "/preflight",
                  openapi: "/openapi.json",
                  pricePerToolUsd: price,
                },
              }),
            },
          ],
          isError: true,
        }),
      );
    }

    const singleNames = new Set(["preflight_check", "verify_payto"]);
    const batchNames = new Set(["preflight_batch", "compare_tools"]);

    if (singleNames.has(name)) {
      const url = typeof args.url === "string" ? args.url.trim() : "";
      if (!url) {
        return c.json(
          ok(id, {
            content: [{ type: "text", text: "missing url" }],
            isError: true,
          }),
        );
      }
      const result = await runOne(url, c.env, args.fresh === true);
      return c.json(
        ok(id, {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        }),
      );
    }

    if (batchNames.has(name)) {
      const list = Array.isArray(args.urls)
        ? (args.urls as unknown[]).filter(
            (u): u is string => typeof u === "string" && !!u.trim(),
          )
        : [];
      if (!list.length || list.length > MAX_BATCH) {
        return c.json(
          ok(id, {
            content: [{ type: "text", text: "urls required (1..25)" }],
            isError: true,
          }),
        );
      }
      const payload = await runBatch(list, c.env, args.fresh === true, price);
      return c.json(
        ok(id, {
          content: [{ type: "text", text: JSON.stringify(payload) }],
          structuredContent: payload,
        }),
      );
    }

    return c.json(err(id, -32601, `Unknown tool: ${name}`));
  }

  return c.json(err(id, -32601, `Method not found: ${method}`));
}
