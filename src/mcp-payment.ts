/**
 * x402 v2 MCP transport payment helpers.
 * Spec: https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/mcp.md
 *
 * Unpaid tools/call → isError tool result with PaymentRequired in structuredContent
 * and content[0].text. Paid retry carries PaymentPayload in params._meta["x402/payment"].
 * Successful settle returns SettleResponse in result._meta["x402/payment-response"].
 */
import { x402ResourceServer } from "@x402/core/server";
import type {
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
  ResourceInfo,
  SettleResponse,
} from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { createFacilitatorClient } from "./facilitator";
import {
  baseAcceptRequirement,
  resolvePayConfig,
  type ResolvedPayConfig,
} from "./payconfig";
import { money, unitPriceUsd, MAX_BATCH } from "./sell";
import type { Env } from "./types";

export const MCP_PAYMENT_META_KEY = "x402/payment";
export const MCP_PAYMENT_RESPONSE_META_KEY = "x402/payment-response";

export const PAID_SINGLE_TOOLS = new Set(["preflight_check", "verify_payto"]);
export const PAID_BATCH_TOOLS = new Set(["preflight_batch", "compare_tools"]);
/** Fixed-price tools (e.g. $5/30d watch) · not per-URL unit pricing. */
export const PAID_WATCH_TOOLS = new Set(["watch_tool"]);
/** Fixed-price deep check ($0.05). */
export const PAID_DEEP_TOOLS = new Set(["deep_check"]);
export const PAID_TOOLS = new Set([
  ...PAID_SINGLE_TOOLS,
  ...PAID_BATCH_TOOLS,
  ...PAID_WATCH_TOOLS,
  ...PAID_DEEP_TOOLS,
]);

export type McpToolContent = { type: "text"; text: string };

export type McpToolResult = {
  content: McpToolContent[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

export type PaymentGate = {
  buildAccepts: (toolCount: number) => Promise<PaymentRequirements[]>;
  createPaymentRequired: (
    accepts: PaymentRequirements[],
    resource: ResourceInfo,
    error: string,
    paymentPayload?: PaymentPayload,
  ) => Promise<PaymentRequired>;
  findMatching: (
    accepts: PaymentRequirements[],
    payload: PaymentPayload,
  ) => PaymentRequirements | undefined;
  verify: (
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ) => Promise<{ isValid: boolean; invalidReason?: string }>;
  settle: (
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ) => Promise<SettleResponse>;
};

/** Count billable seller URLs for a paid MCP tool (same per-URL pricing as HTTP). */
export function billableToolCount(
  toolName: string,
  args: Record<string, unknown>,
): number {
  if (PAID_SINGLE_TOOLS.has(toolName)) {
    const url = typeof args.url === "string" ? args.url.trim() : "";
    return url ? 1 : 0;
  }
  if (PAID_BATCH_TOOLS.has(toolName)) {
    const list = Array.isArray(args.urls)
      ? (args.urls as unknown[]).filter(
          (u): u is string => typeof u === "string" && !!u.trim(),
        )
      : [];
    const seen = new Set<string>();
    let n = 0;
    for (const u of list) {
      const t = u.trim();
      if (seen.has(t)) continue;
      seen.add(t);
      n += 1;
      if (n >= MAX_BATCH) break;
    }
    return n;
  }
  if (PAID_WATCH_TOOLS.has(toolName)) {
    const url = typeof args.url === "string" ? args.url.trim() : "";
    return url ? 1 : 0;
  }
  if (PAID_DEEP_TOOLS.has(toolName)) {
    const url = typeof args.url === "string" ? args.url.trim() : "";
    return url ? 1 : 0;
  }
  return 0;
}

export function toolResourceInfo(
  toolName: string,
  description?: string,
): ResourceInfo {
  return {
    url: `mcp://tool/${toolName}`,
    description: description || `Tool: ${toolName}`,
    mimeType: "application/json",
  };
}

/** Spec-compliant PaymentRequired tool result (isError + structuredContent + content). */
export function paymentRequiredResult(
  paymentRequired: PaymentRequired | Record<string, unknown>,
): McpToolResult {
  return {
    isError: true,
    structuredContent: paymentRequired as Record<string, unknown>,
    content: [
      {
        type: "text",
        text: JSON.stringify(paymentRequired),
      },
    ],
  };
}

export function successToolResult(
  data: unknown,
  settleResponse: SettleResponse,
): McpToolResult {
  const structured =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : { result: data };
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    structuredContent: structured,
    _meta: {
      [MCP_PAYMENT_RESPONSE_META_KEY]: settleResponse,
    },
  };
}

export function extractPaymentFromMeta(
  meta: unknown,
): PaymentPayload | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const raw = (meta as Record<string, unknown>)[MCP_PAYMENT_META_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  // Minimal shape check · full validation is facilitator verify.
  if (typeof obj.x402Version !== "number" || !obj.payload) return null;
  return raw as PaymentPayload;
}

/**
 * Static Base Exact accept (same shape HTTP falls back to), scaled by tool count.
 * Useful for docs/tests and as a challenge when the facilitator is unavailable.
 */
export function buildStaticAccepts(
  cfg: ResolvedPayConfig,
  unitUsd: number,
  toolCount: number,
): PaymentRequirements[] {
  const n = Math.max(1, toolCount);
  const base = baseAcceptRequirement(cfg, unitUsd) as PaymentRequirements;
  const amount = String(Math.round(unitUsd * n * 1_000_000));
  return [
    {
      ...base,
      amount,
      extra: {
        ...(base.extra || {}),
        pricePerToolUsd: unitUsd,
        pricingModel: "per_tool",
        chargedTools: n,
      },
    } as PaymentRequirements,
  ];
}

export function buildStaticPaymentRequired(
  toolName: string,
  cfg: ResolvedPayConfig,
  unitUsd: number,
  toolCount: number,
  error: string,
  description?: string,
): PaymentRequired {
  return {
    x402Version: 2,
    error,
    resource: toolResourceInfo(toolName, description),
    accepts: buildStaticAccepts(cfg, unitUsd, toolCount),
  };
}

/**
 * Gate a paid MCP tool call per transports-v2/mcp.md.
 * Inject `gate` in tests to mock verify/settle.
 */
export async function gatePaidToolCall(opts: {
  toolName: string;
  args: Record<string, unknown>;
  meta?: unknown;
  description?: string;
  unitUsd: number;
  toolCount: number;
  gate: PaymentGate;
  run: () => Promise<unknown>;
}): Promise<McpToolResult> {
  const {
    toolName,
    meta,
    description,
    unitUsd,
    toolCount,
    gate,
    run,
  } = opts;
  const resource = toolResourceInfo(toolName, description);
  const n = Math.max(1, toolCount);

  let accepts: PaymentRequirements[];
  try {
    accepts = await gate.buildAccepts(n);
  } catch (e) {
    // Facilitator/init failure: still return a spec-shaped challenge so agents can pay.
    const cfg = resolvePayConfig({});
    return paymentRequiredResult(
      buildStaticPaymentRequired(
        toolName,
        cfg,
        unitUsd,
        n,
        e instanceof Error ? e.message : "Payment required to access this tool",
        description,
      ),
    );
  }

  if (!accepts.length) {
    return paymentRequiredResult(
      await gate.createPaymentRequired(
        accepts,
        resource,
        "Payment required to access this tool",
      ),
    );
  }

  const paymentPayload = extractPaymentFromMeta(meta);
  if (!paymentPayload) {
    const pr = await gate.createPaymentRequired(
      accepts,
      resource,
      "Payment required to access this tool",
    );
    return paymentRequiredResult(pr);
  }

  const matched = gate.findMatching(accepts, paymentPayload);
  if (!matched) {
    const pr = await gate.createPaymentRequired(
      accepts,
      resource,
      "No matching payment requirements found",
      paymentPayload,
    );
    return paymentRequiredResult(pr);
  }

  const verifyResult = await gate.verify(paymentPayload, matched);
  if (!verifyResult.isValid) {
    const pr = await gate.createPaymentRequired(
      accepts,
      resource,
      verifyResult.invalidReason || "Payment verification failed",
      paymentPayload,
    );
    return paymentRequiredResult(pr);
  }

  let data: unknown;
  try {
    data = await run();
  } catch (e) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: e instanceof Error ? e.message : "Tool execution failed",
        },
      ],
    };
  }

  let settleResult: SettleResponse;
  try {
    settleResult = await gate.settle(paymentPayload, matched);
  } catch (e) {
    const pr = await gate.createPaymentRequired(
      accepts,
      resource,
      e instanceof Error
        ? `Settlement failed: ${e.message}`
        : "Settlement failed",
      paymentPayload,
    );
    return paymentRequiredResult(pr);
  }

  if (!settleResult.success) {
    const pr = await gate.createPaymentRequired(
      accepts,
      resource,
      settleResult.errorReason ||
        settleResult.errorMessage ||
        "Settlement failed",
      paymentPayload,
    );
    return paymentRequiredResult(pr);
  }

  return successToolResult(data, settleResult);
}

export type LiveGateOpts = {
  /** When set, charge this fixed USD amount (ignore per-tool unit × count). */
  fixedUsd?: number;
  pricingModel?: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
};

/** Build a live PaymentGate backed by the same facilitator + Exact schemes as HTTP. */
export async function createLivePaymentGate(
  env: Env,
  opts: LiveGateOpts = {},
): Promise<PaymentGate> {
  const unit = unitPriceUsd(env.PRICE_PER_TOOL_USD || env.PRICE?.replace("$", ""));
  const pay = resolvePayConfig(env);
  const facilitatorUrl =
    env.FACILITATOR_URL || "https://api.cdp.coinbase.com/platform/v2/x402";
  const facilitatorClient = createFacilitatorClient(facilitatorUrl, {
    CDP_API_KEY_ID: env.CDP_API_KEY_ID,
    CDP_API_KEY_SECRET: env.CDP_API_KEY_SECRET,
  });
  const server = new x402ResourceServer(facilitatorClient).register(
    pay.evmNetwork,
    new ExactEvmScheme(),
  );
  if (pay.solanaPayTo && pay.solanaNetwork) {
    server.register(pay.solanaNetwork, new ExactSvmScheme());
  }
  await server.initialize();
  const fixedUsd = opts.fixedUsd;
  const pricingModel = opts.pricingModel || (fixedUsd != null ? "fixed" : "per_tool");
  const maxTimeout = opts.maxTimeoutSeconds ?? (fixedUsd != null ? 120 : 60);

  return {
    async buildAccepts(toolCount: number) {
      const n = Math.max(1, toolCount);
      const total = fixedUsd != null ? fixedUsd : n * unit;
      const price = money(total);
      const commonExtra = {
        pricePerToolUsd: fixedUsd != null ? fixedUsd : unit,
        pricingModel,
        chargedTools: fixedUsd != null ? 1 : n,
        batchNote:
          fixedUsd != null
            ? "Fixed Exact settlement for this tool."
            : "MCP batch tools charge N×unit in ONE Exact settlement (not N separate txs).",
        ...(opts.extra || {}),
      };
      const options: Array<{
        scheme: string;
        payTo: string;
        price: `$${string}`;
        network: `${string}:${string}`;
        maxTimeoutSeconds: number;
        extra: Record<string, unknown>;
      }> = [
        {
          scheme: "exact",
          payTo: pay.evmPayTo,
          price,
          network: pay.evmNetwork,
          maxTimeoutSeconds: maxTimeout,
          extra: {
            ...commonExtra,
            assetHint: "USDC",
            chainFamily: "evm",
          },
        },
      ];
      if (pay.solanaPayTo && pay.solanaNetwork) {
        options.push({
          scheme: "exact",
          payTo: pay.solanaPayTo,
          price,
          network: pay.solanaNetwork,
          maxTimeoutSeconds: maxTimeout,
          extra: {
            ...commonExtra,
            assetHint: "USDC",
            chainFamily: "svm",
          },
        });
      }
      return server.buildPaymentRequirementsFromOptions(options, {});
    },
    createPaymentRequired(accepts, resource, error, paymentPayload) {
      return server.createPaymentRequiredResponse(
        accepts,
        resource,
        error,
        undefined,
        { transport: "mcp" },
        paymentPayload,
      );
    },
    findMatching(accepts, payload) {
      return server.findMatchingRequirements(accepts, payload);
    },
    async verify(payload, requirements) {
      const res = await server.verifyPayment(payload, requirements, undefined, {
        transport: "mcp",
      });
      return {
        isValid: !!res.isValid,
        invalidReason: res.invalidReason,
      };
    },
    settle(payload, requirements) {
      return server.settlePayment(
        payload,
        requirements,
        undefined,
        { transport: "mcp" },
        undefined,
        "after-handler",
      );
    },
  };
}
