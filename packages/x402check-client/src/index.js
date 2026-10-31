/**
 * Tiny client wrapper: trust-check a seller before paying.
 * Draft only — do not npm publish without Nicklaus approval.
 *
 * Usage:
 *   import { preflight, assertPayable, withPreflightPay } from '@x402check/client';
 *
 * Env:
 *   X402CHECK_URL  base origin (required in prod)
 *   X402CHECK_SKIP=1  kill-switch
 */

/** @typedef {'ok'|'caution'|'avoid'} Verdict */
/** @typedef {{ url: string, verdict: Verdict, reasonCodes?: string[], history?: object, payTo?: string|null, priceUsd?: number|null }} ToolCheck */

/**
 * @param {string} sellerUrl
 * @param {{ baseUrl?: string, fresh?: boolean, fetchImpl?: typeof fetch, paymentHeaders?: Record<string,string> }} [opts]
 * @returns {Promise<ToolCheck>}
 */
export async function preflight(sellerUrl, opts = {}) {
  if (process.env.X402CHECK_SKIP === "1") {
    return {
      url: sellerUrl,
      verdict: "ok",
      reasonCodes: ["preflight_skipped"],
      history: { checks: 0 },
    };
  }
  const base = (opts.baseUrl || process.env.X402CHECK_URL || "").replace(/\/$/, "");
  if (!base) {
    throw new Error("X402CHECK_URL (or opts.baseUrl) required");
  }
  const f = opts.fetchImpl || fetch;
  const q = new URLSearchParams({ url: sellerUrl });
  if (opts.fresh) q.set("fresh", "1");
  const res = await f(`${base}/preflight?${q}`, {
    headers: { accept: "application/json", ...(opts.paymentHeaders || {}) },
  });
  if (res.status === 402) {
    const err = new Error("preflight_payment_required");
    err.status = 402;
    err.headers = Object.fromEntries(res.headers.entries());
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`preflight_http_${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * @param {string[]} sellerUrls
 * @param {{ baseUrl?: string, fresh?: boolean, fetchImpl?: typeof fetch, paymentHeaders?: Record<string,string> }} [opts]
 */
export async function preflightBatch(sellerUrls, opts = {}) {
  const base = (opts.baseUrl || process.env.X402CHECK_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("X402CHECK_URL (or opts.baseUrl) required");
  const f = opts.fetchImpl || fetch;
  const res = await f(`${base}/preflight`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(opts.paymentHeaders || {}),
    },
    body: JSON.stringify({ urls: sellerUrls, fresh: !!opts.fresh }),
  });
  if (res.status === 402) {
    const err = new Error("preflight_payment_required");
    err.status = 402;
    throw err;
  }
  if (!res.ok) throw new Error(`preflight_http_${res.status}`);
  return res.json();
}

/**
 * Throw if verdict is avoid (and optionally caution).
 * @param {ToolCheck} check
 * @param {{ allowCaution?: boolean }} [policy]
 */
export function assertPayable(check, policy = {}) {
  if (check.verdict === "avoid") {
    const e = new Error(`preflight_deny: ${check.url} verdict=avoid`);
    e.check = check;
    throw e;
  }
  if (check.verdict === "caution" && policy.allowCaution === false) {
    const e = new Error(`preflight_caution: ${check.url}`);
    e.check = check;
    throw e;
  }
  return check;
}

/**
 * Wrap a pay function so preflight runs first.
 * @param {(sellerUrl: string, ...args: any[]) => Promise<any>} payFn
 * @param {{ baseUrl?: string, allowCaution?: boolean }} [opts]
 */
export function withPreflightPay(payFn, opts = {}) {
  return async function guarded(sellerUrl, ...args) {
    const check = await preflight(sellerUrl, opts);
    assertPayable(check, { allowCaution: opts.allowCaution !== false });
    return payFn(sellerUrl, ...args);
  };
}

export default { preflight, preflightBatch, assertPayable, withPreflightPay };
