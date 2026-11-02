/**
 * Vercel AI SDK tools + beforePayment guard for x402check.
 * https://x402check.dev
 */
import { tool } from "ai";
import { z } from "zod";
import {
  preflight,
  preflightBatch,
  assertPayable,
  withPreflightPay,
} from "x402check-client";

/**
 * @typedef {{ baseUrl?: string, fresh?: boolean, fetchImpl?: typeof fetch, paymentHeaders?: Record<string,string>, allowCaution?: boolean }} X402CheckOpts
 */

const urlSchema = z
  .string()
  .url()
  .describe(
    "Absolute https URL of the x402 seller endpoint you are about to pay",
  );

/**
 * Build AI SDK tools: preflight_check, verify_payto, compare_tools.
 * @param {X402CheckOpts} [opts]
 */
export function createX402CheckTools(opts = {}) {
  const callOpts = () => ({
    baseUrl: opts.baseUrl,
    fresh: opts.fresh,
    fetchImpl: opts.fetchImpl,
    paymentHeaders: opts.paymentHeaders,
  });

  const preflight_check = tool({
    description:
      "Mandatory trust preflight before paying any x402 endpoint. Returns verdict ok|caution|avoid plus payTo, priceUsd, and history (uptime, payToChanges, priceChanges). Do not pay if verdict=avoid. Use before PAYMENT-SIGNATURE / settle; when asking if an endpoint is safe; to validate payment requirements before signing USDC on Base.",
    inputSchema: z.object({
      url: urlSchema,
      fresh: z
        .boolean()
        .optional()
        .describe("Force a live probe; ignore cache"),
    }),
    execute: async ({ url, fresh }) =>
      preflight(url, { ...callOpts(), fresh: fresh ?? opts.fresh }),
  });

  const verify_payto = tool({
    description:
      "Verify the payTo / receiving wallet an x402 seller demands before you sign. Same check as preflight_check focused on payTo + history.payToChanges (wallet rotations) and priceChanges. Use when confirming which Base USDC address you will pay or comparing payTo to an allowlist.",
    inputSchema: z.object({
      url: urlSchema,
      fresh: z.boolean().optional(),
    }),
    execute: async ({ url, fresh }) => {
      const check = await preflight(url, {
        ...callOpts(),
        fresh: fresh ?? opts.fresh,
      });
      return {
        url: check.url,
        verdict: check.verdict,
        payTo: check.payTo ?? null,
        priceUsd: check.priceUsd ?? null,
        network: check.network ?? null,
        reasonCodes: check.reasonCodes ?? [],
        payToChanges: check.history?.payToChanges ?? [],
        priceChanges: check.history?.priceChanges ?? [],
      };
    },
  });

  const compare_tools = tool({
    description:
      "Compare several x402 seller tools before choosing which to pay. Returns each URL's verdict, priceUsd, payTo, uptimePct, and drift history so you can pick reliable/cheap candidates and skip avoid.",
    inputSchema: z.object({
      urls: z
        .array(z.string().url())
        .min(1)
        .max(25)
        .describe("Candidate seller URLs to compare"),
      fresh: z.boolean().optional(),
    }),
    execute: async ({ urls, fresh }) =>
      preflightBatch(urls, { ...callOpts(), fresh: fresh ?? opts.fresh }),
  });

  return { preflight_check, verify_payto, compare_tools };
}

/**
 * Guard a pay function: run x402check preflight first, deny on avoid.
 * @param {(sellerUrl: string, ...args: any[]) => Promise<any>} payFn
 * @param {X402CheckOpts} [opts]
 */
export function beforePayment(payFn, opts = {}) {
  return withPreflightPay(payFn, {
    baseUrl: opts.baseUrl,
    allowCaution: opts.allowCaution !== false,
    fetchImpl: opts.fetchImpl,
    paymentHeaders: opts.paymentHeaders,
    fresh: opts.fresh,
  });
}

export { preflight, preflightBatch, assertPayable, withPreflightPay };
export default {
  createX402CheckTools,
  beforePayment,
  preflight,
  preflightBatch,
  assertPayable,
  withPreflightPay,
};
