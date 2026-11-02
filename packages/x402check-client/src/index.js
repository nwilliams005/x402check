/**
 * Tiny client wrapper: trust-check a seller before paying.
 * Published to npm as x402check-client.
 *
 * Usage:
 *   import { preflight, assertPayable, withPreflightPay, wrapFetch, createAxiosRequestInterceptor } from 'x402check-client';
 *
 * Env:
 *   X402CHECK_URL  base origin (required in prod)
 *   X402CHECK_SKIP=1  kill-switch
 *
 * Pricing (paid to x402check, not the seller):
 *   1 free regular check ever per agent wallet, then $0.01 / URL Exact USDC on Base.
 *   wrapFetch / axios interceptor call preflight and therefore incur that cost.
 */

/** @typedef {'ok'|'caution'|'avoid'} Verdict */
/** @typedef {{ url: string, verdict: Verdict, reasonCodes?: string[], history?: object, payTo?: string|null, priceUsd?: number|null, network?: string|null }} ToolCheck */
/**
 * @typedef {{
 *   baseUrl?: string,
 *   fresh?: boolean,
 *   fetchImpl?: typeof fetch,
 *   paymentHeaders?: Record<string,string>,
 *   allowCaution?: boolean,
 *   skipHosts?: string[],
 * }} PreflightOpts
 */

function resolveBase(opts = {}) {
  return (opts.baseUrl || process.env.X402CHECK_URL || "").replace(/\/$/, "");
}

function requestUrl(input, init) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input.url === "string") return input.url;
  if (init && typeof init.url === "string") return init.url;
  return "";
}

function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

function shouldSkip(url, opts = {}) {
  const host = hostOf(url);
  if (!host) return true;
  const base = resolveBase(opts);
  if (base) {
    try {
      if (host === new URL(base).host.toLowerCase()) return true;
    } catch {
      /* ignore */
    }
  }
  const skips = opts.skipHosts || ["x402check.dev"];
  return skips.some((h) => host === String(h).toLowerCase());
}

/**
 * @param {string} sellerUrl
 * @param {PreflightOpts} [opts]
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
  const base = resolveBase(opts);
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
 * @param {PreflightOpts} [opts]
 */
export async function preflightBatch(sellerUrls, opts = {}) {
  const base = resolveBase(opts);
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
 * @param {PreflightOpts} [opts]
 */
export function withPreflightPay(payFn, opts = {}) {
  return async function guarded(sellerUrl, ...args) {
    const check = await preflight(sellerUrl, opts);
    assertPayable(check, { allowCaution: opts.allowCaution !== false });
    return payFn(sellerUrl, ...args);
  };
}

/**
 * Opt-in fetch wrapper: preflight the request URL before the call.
 * Pays x402check ($0.01 / URL after the 1 free check per wallet) via `preflight`.
 * Does not pay the seller. Skips x402check.dev (and opts.skipHosts) by default.
 *
 * Typical use with @x402/fetch:
 *   const checked = wrapFetch(fetch, { baseUrl: 'https://x402check.dev', paymentHeaders })
 *   const pay = wrapFetchWithPayment(checked, x402Client)
 *
 * @param {typeof fetch} [fetchImpl]
 * @param {PreflightOpts} [opts]
 * @returns {typeof fetch}
 */
export function wrapFetch(fetchImpl, opts = {}) {
  const inner = fetchImpl || fetch;
  /** @type {typeof fetch} */
  const wrapped = async function wrappedFetch(input, init) {
    const url = requestUrl(input, init);
    if (url && !shouldSkip(url, opts)) {
      const check = await preflight(url, opts);
      assertPayable(check, { allowCaution: opts.allowCaution !== false });
    }
    return inner(input, init);
  };
  return wrapped;
}

/**
 * Opt-in Axios request interceptor: preflight `config.url` (joined with baseURL) before send.
 * Pays x402check ($0.01 / URL after the 1 free check per wallet) via `preflight`.
 *
 *   axios.interceptors.request.use(createAxiosRequestInterceptor({ baseUrl: 'https://x402check.dev' }))
 *   // then add @x402/axios payment interceptor as usual
 *
 * @param {PreflightOpts} [opts]
 * @returns {(config: any) => Promise<any>}
 */
export function createAxiosRequestInterceptor(opts = {}) {
  return async function x402checkRequestInterceptor(config = {}) {
    const base = config.baseURL || "";
    const path = config.url || "";
    let url = path;
    if (base && path && !/^https?:\/\//i.test(path)) {
      try {
        url = new URL(path, base).href;
      } catch {
        url = `${String(base).replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`;
      }
    }
    if (url && !shouldSkip(url, opts)) {
      const check = await preflight(url, opts);
      assertPayable(check, { allowCaution: opts.allowCaution !== false });
      config.x402check = check;
    }
    return config;
  };
}

/** @deprecated use createAxiosRequestInterceptor */
export const axiosInterceptor = createAxiosRequestInterceptor;

export default {
  preflight,
  preflightBatch,
  assertPayable,
  withPreflightPay,
  wrapFetch,
  createAxiosRequestInterceptor,
  axiosInterceptor,
};
