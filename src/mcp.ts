/**
 * Minimal Streamable-HTTP MCP JSON-RPC surface for discovery + tool proxy.
 * tools/list is free. tools/call proxies to /preflight (caller must satisfy x402
 * on that HTTP path, or use local_bypass in dev).
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

function toolList(price: number) {
  return {
    tools: [
      {
        name: "preflight_check",
        description:
          "Before paying any x402 endpoint, call with absolute https URL. Returns verdict ok|caution|avoid plus that tool's history. Do not pay if avoid. Paid per call via x402 on GET /preflight.",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", description: "Absolute https x402 seller URL" },
            fresh: { type: "boolean" },
          },
        },
        annotations: {
          title: "x402 preflight check",
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
        _meta: { pricePerToolUsd: price },
      },
      {
        name: "preflight_batch",
        description:
          "Trust-check up to 25 x402 seller URLs. Charged per URL. Prefer when comparing which tool to pay.",
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
        _meta: { pricePerToolUsd: price },
      },
    ],
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
          version: "0.2.0",
        },
        instructions:
          `Use preflight_check before any x402 payment. Unit $${price}/tool. Deny pay when verdict=avoid.`,
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

    // MCP tools/call is free at the JSON-RPC layer only when local bypass is on;
    // production agents should pay via HTTP GET/POST /preflight (x402).
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
                  "Pay via x402 Exact on HTTP GET/POST /preflight (PAYMENT-SIGNATURE), or use @scope/x402check-client. MCP tools/call does not settle payment itself.",
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

    if (name === "preflight_check") {
      const url = typeof args.url === "string" ? args.url.trim() : "";
      if (!url) {
        return c.json(ok(id, { content: [{ type: "text", text: "missing url" }], isError: true }));
      }
      if (isBlockedHost(url)) {
        return c.json(
          ok(id, {
            content: [{ type: "text", text: JSON.stringify({ verdict: "avoid", error: "blocked_host" }) }],
            isError: true,
          }),
        );
      }
      const result = await checkTool(url, c.env, {
        forceLive: args.fresh === true,
      });
      return c.json(
        ok(id, {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        }),
      );
    }

    if (name === "preflight_batch") {
      const list = Array.isArray(args.urls)
        ? (args.urls as unknown[]).filter((u): u is string => typeof u === "string" && !!u.trim())
        : [];
      if (!list.length || list.length > MAX_BATCH) {
        return c.json(
          ok(id, {
            content: [{ type: "text", text: "urls required (1..25)" }],
            isError: true,
          }),
        );
      }
      const results: ToolCheck[] = [];
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
        results.push(await checkTool(url, c.env, { forceLive: args.fresh === true }));
      }
      const payload = {
        results,
        chargedTools: list.length,
        pricePerToolUsd: price,
        totalUsd: Number((list.length * price).toFixed(6)),
      };
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
