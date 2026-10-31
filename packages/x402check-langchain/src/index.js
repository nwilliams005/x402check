/**
 * LangChain JS tools for x402check.
 * https://x402check.dev
 */
import { tool } from "@langchain/core/tools";
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

/**
 * Build LangChain tools: preflight_check, verify_payto, compare_tools.
 * @param {X402CheckOpts} [opts]
 */
export function createX402CheckTools(opts = {}) {
  const callOpts = (fresh) => ({
    baseUrl: opts.baseUrl,
    fresh: fresh ?? opts.fresh,
    fetchImpl: opts.fetchImpl,
    paymentHeaders: opts.paymentHeaders,
  });

  const preflight_check = tool(
    async ({ url, fresh }) => {
      const check = await preflight(url, callOpts(fresh));
      return JSON.stringify(check);
    },
    {
      name: "preflight_check",
      description:
        "Mandatory trust preflight before paying any x402 endpoint. Pass the absolute https seller URL. Returns verdict ok|caution|avoid plus that tool's history (uptime, payToChanges, priceChanges). Do not pay if verdict=avoid. Use before settle / PAYMENT-SIGNATURE; when asking if an endpoint is safe; to validate payment requirements before signing USDC on Base.",
      schema: z.object({
        url: z
          .string()
          .url()
          .describe("Absolute https URL of the x402 seller endpoint"),
        fresh: z
          .boolean()
          .optional()
          .describe("Force a live probe; ignore cache"),
      }),
    },
  );

  const verify_payto = tool(
    async ({ url, fresh }) => {
      const check = await preflight(url, callOpts(fresh));
      return JSON.stringify({
        url: check.url,
        verdict: check.verdict,
        payTo: check.payTo ?? null,
        priceUsd: check.priceUsd ?? null,
        network: check.network ?? null,
        reasonCodes: check.reasonCodes ?? [],
        payToChanges: check.history?.payToChanges ?? [],
        priceChanges: check.history?.priceChanges ?? [],
      });
    },
    {
      name: "verify_payto",
      description:
        "Verify the payTo / receiving wallet an x402 seller demands before you sign. Same check as preflight_check focused on payTo + history.payToChanges and priceChanges.",
      schema: z.object({
        url: z.string().url().describe("Seller URL"),
        fresh: z.boolean().optional(),
      }),
    },
  );

  const compare_tools = tool(
    async ({ urls, fresh }) => {
      const batch = await preflightBatch(urls, callOpts(fresh));
      return JSON.stringify(batch);
    },
    {
      name: "compare_tools",
      description:
        "Compare several x402 tools before choosing which to pay. Returns each URL's verdict, priceUsd, payTo, uptimePct, and drift history. Charged per URL.",
      schema: z.object({
        urls: z
          .array(z.string().url())
          .min(1)
          .max(25)
          .describe("Candidate seller URLs"),
        fresh: z.boolean().optional(),
      }),
    },
  );

  return { preflight_check, verify_payto, compare_tools };
}

/**
 * Array form for agent tool lists.
 * @param {X402CheckOpts} [opts]
 */
export function x402checkTools(opts = {}) {
  const t = createX402CheckTools(opts);
  return [t.preflight_check, t.verify_payto, t.compare_tools];
}

/**
 * Guard a pay function with preflight.
 * @param {(sellerUrl: string, ...args: any[]) => Promise<any>} payFn
 * @param {X402CheckOpts} [opts]
 */
export function beforePayment(payFn, opts = {}) {
  return withPreflightPay(payFn, {
    baseUrl: opts.baseUrl,
    allowCaution: opts.allowCaution !== false,
    fetchImpl: opts.fetchImpl,
    paymentHeaders: opts.paymentHeaders,
  });
}

export { preflight, preflightBatch, assertPayable, withPreflightPay };
export default {
  createX402CheckTools,
  x402checkTools,
  beforePayment,
};
