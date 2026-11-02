import type {
  AcceptOffer,
  Env,
  PreflightResult,
  Reason,
  ReasonCode,
  ToolCheck,
  Verdict,
} from "./types";
import {
  atomicToUsd,
  categorizeUrl,
  categoryCeiling,
  isHighForCategory,
} from "./pricing";
import { loadToolRecord, recordToolCheck, summarize } from "./history";
import { checkBazaarListing } from "./bazaar";

const UA = "x402check/0.2 (+agent-trust-check; read-only GET; never pays targets)";

function decodePaymentRequiredHeader(raw: string | null): unknown | null {
  if (!raw) return null;
  try {
    return JSON.parse(atob(raw));
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

function pickPaymentPayload(
  status: number,
  headers: Headers,
  bodyText: string,
): Record<string, unknown> | null {
  for (const h of [
    headers.get("PAYMENT-REQUIRED"),
    headers.get("payment-required"),
    headers.get("X-PAYMENT-REQUIRED"),
    headers.get("x-payment-required"),
  ]) {
    const decoded = decodePaymentRequiredHeader(h);
    if (decoded && typeof decoded === "object") return decoded as Record<string, unknown>;
  }
  const www = headers.get("www-authenticate") || headers.get("WWW-Authenticate");
  if (www) {
    const m = www.match(/requirements="([^"]+)"/i);
    if (m) {
      const decoded = decodePaymentRequiredHeader(m[1]);
      if (decoded && typeof decoded === "object") return decoded as Record<string, unknown>;
    }
  }
  if (bodyText) {
    try {
      const j = JSON.parse(bodyText) as Record<string, unknown>;
      if (j.accepts || j.x402Version || j.resource) return j;
    } catch {
      /* ignore */
    }
  }
  if (status === 402) return { _empty402: true };
  return null;
}

function parseAccepts(payload: Record<string, unknown> | null): AcceptOffer[] {
  if (!payload) return [];
  const accepts = payload.accepts;
  if (!Array.isArray(accepts)) return [];
  return accepts.map((a: Record<string, unknown>) => {
    const amountAtomic = String(a.amount ?? a.maxAmountRequired ?? "0");
    const extra = (a.extra || {}) as Record<string, unknown>;
    return {
      scheme: String(a.scheme || "exact"),
      network: String(a.network || ""),
      amountAtomic,
      amountUsd: atomicToUsd(amountAtomic),
      asset: String(a.asset || ""),
      assetName: extra.name ? String(extra.name) : undefined,
      payTo: String(a.payTo || ""),
      maxTimeoutSeconds:
        typeof a.maxTimeoutSeconds === "number" ? a.maxTimeoutSeconds : undefined,
    };
  });
}

function worstVerdict(reasons: Reason[]): Verdict {
  if (reasons.some((r) => r.severity === "critical")) return "avoid";
  if (reasons.some((r) => r.severity === "warn")) return "caution";
  return "ok";
}

function normalizeUrl(targetUrl: string): string {
  const u = new URL(targetUrl.trim());
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) URLs allowed");
  }
  return u.toString();
}

export function isBlockedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.startsWith("169.254.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host === "metadata.google.internal"
    );
  } catch {
    return true;
  }
}

/** Live probe (internal). Prefer checkTool() for API responses. */
export async function runPreflight(
  targetUrl: string,
  env: Pick<Env, "PAYTO_HISTORY">,
  opts: { checkBazaar?: boolean } = {},
): Promise<PreflightResult> {
  const reasons: Reason[] = [];
  const checkedAt = new Date().toISOString();
  let normalized: string;
  try {
    normalized = normalizeUrl(targetUrl);
  } catch (e) {
    return emptyAvoid(targetUrl, checkedAt, String(e));
  }

  const t0 = Date.now();
  let status: number | null = null;
  let latencyMs: number | null = null;
  let bodyText = "";
  let headers = new Headers();
  let fetchError: string | null = null;
  let tlsOk: boolean | null = null;

  try {
    const res = await fetch(normalized, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": UA,
      },
      signal: AbortSignal.timeout(8_000),
    });
    status = res.status;
    latencyMs = Date.now() - t0;
    headers = res.headers;
    bodyText = await res.text();
    tlsOk = normalized.startsWith("https:");
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e);
    latencyMs = Date.now() - t0;
    const tlsish = /tls|ssl|certificate|eof while reading/i.test(fetchError);
    tlsOk = tlsish ? false : normalized.startsWith("https:") ? null : true;
  }

  if (fetchError) {
    reasons.push({
      code: "unreachable",
      severity: "critical",
      message: `Endpoint unreachable: ${fetchError}`,
    });
    if (tlsOk === false) {
      reasons.push({
        code: "tls_issue",
        severity: "critical",
        message: "TLS/SSL handshake failed or aborted unexpectedly.",
      });
    }
  } else {
    reasons.push({
      code: "reachable",
      severity: "info",
      message: `Reached endpoint in ${latencyMs}ms (HTTP ${status}).`,
    });
    if (tlsOk) {
      reasons.push({
        code: "tls_ok",
        severity: "info",
        message: "HTTPS fetch completed.",
      });
    }
    if (latencyMs != null && latencyMs > 5000) {
      reasons.push({
        code: "slow_latency",
        severity: "warn",
        message: `Latency ${latencyMs}ms is high for a pre-pay check (>5s).`,
      });
    }
  }

  const payload = fetchError ? null : pickPaymentPayload(status || 0, headers, bodyText);
  const is402 = status === 402;
  if (!fetchError) {
    if (is402) {
      reasons.push({
        code: "http_402",
        severity: "info",
        message: "Server returned HTTP 402 Payment Required.",
      });
    } else {
      reasons.push({
        code: "not_402",
        severity: status === 405 ? "warn" : "critical",
        message:
          status === 405
            ? "Got HTTP 405 · unpaid GET did not yield x402 envelope."
            : `Expected HTTP 402; got HTTP ${status}.`,
      });
      if (status === 405) {
        reasons.push({
          code: "method_hint_post",
          severity: "warn",
          message: "Endpoint may require POST/other method.",
        });
      }
    }
  }

  const accepts = parseAccepts(payload);
  const resource = (payload?.resource || {}) as Record<string, unknown>;
  const description =
    (typeof resource.description === "string" && resource.description) ||
    (typeof payload?.description === "string" && (payload.description as string)) ||
    null;
  const serviceName =
    (typeof resource.serviceName === "string" && resource.serviceName) || null;
  const x402Version =
    typeof payload?.x402Version === "number" ? (payload.x402Version as number) : null;
  const extensions = (payload?.extensions || {}) as Record<string, unknown>;
  const hasBazaarExtension = Boolean(extensions.bazaar);

  if (is402 && accepts.length > 0) {
    reasons.push({
      code: "valid_payment_requirements",
      severity: "info",
      message: `Parsed ${accepts.length} payment accept option(s).`,
    });
  } else if (is402) {
    reasons.push({
      code: "invalid_payment_requirements",
      severity: "critical",
      message: "HTTP 402 without parseable accepts[] · do not pay.",
    });
  } else if (!fetchError) {
    reasons.push({
      code: "invalid_payment_requirements",
      severity: "critical",
      message: "No valid x402 payment requirements found.",
    });
  }

  const primary = accepts[0] || null;
  const primaryUsd = primary?.amountUsd ?? null;
  const category = categorizeUrl(normalized, description);
  const high = isHighForCategory(primaryUsd, category);
  if (primaryUsd != null) {
    reasons.push(
      high
        ? {
            code: "price_high_for_category",
            severity: "warn",
            message: `Price $${primaryUsd} high vs typical max $${categoryCeiling(category)} for "${category}".`,
          }
        : {
            code: "price_ok",
            severity: "info",
            message: `Price $${primaryUsd} within band for "${category}".`,
          },
    );
  }

  let payToHistory: PreflightResult["payToHistory"] = {
    current: primary?.payTo || null,
    previous: null,
    changed: false,
    firstSeen: false,
    lastSeenAt: null,
  };

  const prior = await loadToolRecord(env.PAYTO_HISTORY, normalized);
  if (primary?.payTo) {
    const prev = prior?.lastPayTo || null;
    const changed = Boolean(prev && prev.toLowerCase() !== primary.payTo.toLowerCase());
    payToHistory = {
      current: primary.payTo,
      previous: changed ? prev : prior?.payToChanges?.[0]?.from || null,
      changed,
      firstSeen: !prior,
      lastSeenAt: prior?.lastCheckedAt || null,
    };
    if (!prior) {
      reasons.push({
        code: "payto_first_seen",
        severity: "info",
        message: `First sighting of payTo ${primary.payTo}.`,
      });
    } else if (changed) {
      reasons.push({
        code: "payto_changed",
        severity: "critical",
        message: `payTo changed (was ${prev}, now ${primary.payTo}).`,
      });
    } else {
      reasons.push({
        code: "payto_stable",
        severity: "info",
        message: `payTo unchanged (${primary.payTo}).`,
      });
    }
  }

  let bazaar: PreflightResult["bazaar"] = {
    checked: false,
    listed: null,
    matchCount: null,
    note: "Skipped",
  };

  // Skip bazaar on hot path for latency; optional
  if (opts.checkBazaar === true) {
    bazaar = await checkBazaarListing(normalized);
    if (bazaar.listed === true) {
      reasons.push({ code: "listed_in_bazaar", severity: "info", message: bazaar.note });
    } else if (bazaar.listed === false) {
      reasons.push({ code: "not_listed_in_bazaar", severity: "warn", message: bazaar.note });
    } else if (bazaar.checked) {
      reasons.push({ code: "bazaar_check_failed", severity: "info", message: bazaar.note });
    }
  } else {
    reasons.push({
      code: "bazaar_check_skipped",
      severity: "info",
      message: "Bazaar check skipped for latency.",
    });
  }

  return {
    verdict: worstVerdict(reasons),
    checkedAt,
    targetUrl: normalized,
    reachability: {
      ok: !fetchError,
      status,
      latencyMs,
      error: fetchError,
    },
    tls: {
      ok: tlsOk,
      note:
        tlsOk === true
          ? "HTTPS OK"
          : tlsOk === false
            ? "TLS problem"
            : "TLS unknown",
    },
    x402: {
      is402,
      x402Version,
      description,
      serviceName,
      accepts,
      hasBazaarExtension,
      rawError: typeof payload?.error === "string" ? (payload.error as string) : fetchError,
    },
    price: {
      primaryUsd,
      category,
      highForCategory: high,
      categoryTypicalMaxUsd: categoryCeiling(category),
    },
    payToHistory,
    bazaar,
    reasons,
    disclaimer:
      "Read-only GET probes only; never pays the target. Heuristics, not guarantees. x402 payments are generally irreversible.",
  };
}

function emptyAvoid(targetUrl: string, checkedAt: string, err: string): PreflightResult {
  return {
    verdict: "avoid",
    checkedAt,
    targetUrl,
    reachability: { ok: false, status: null, latencyMs: null, error: err },
    tls: { ok: false, note: "Invalid URL" },
    x402: {
      is402: false,
      x402Version: null,
      description: null,
      serviceName: null,
      accepts: [],
      hasBazaarExtension: false,
      rawError: "invalid_url",
    },
    price: {
      primaryUsd: null,
      category: "unknown",
      highForCategory: false,
      categoryTypicalMaxUsd: categoryCeiling("unknown"),
    },
    payToHistory: {
      current: null,
      previous: null,
      changed: false,
      firstSeen: false,
      lastSeenAt: null,
    },
    bazaar: { checked: false, listed: null, matchCount: null, note: "Skipped" },
    reasons: [
      {
        code: "unreachable",
        severity: "critical",
        message: `Invalid target URL: ${err}`,
      },
    ],
    disclaimer: "Invalid URL.",
  };
}

function fromCache(
  url: string,
  rec: NonNullable<Awaited<ReturnType<typeof loadToolRecord>>>,
  now: number,
): ToolCheck {
  const last = Date.parse(rec.lastCheckedAt || "") || now;
  return {
    url,
    verdict: rec.lastVerdict || "avoid",
    checkedAt: rec.lastCheckedAt || new Date(now).toISOString(),
    live: false,
    cacheAgeMs: Math.max(0, now - last),
    status: rec.lastStatus,
    latencyMs: rec.lastLatencyMs,
    is402: rec.lastIs402,
    priceUsd: rec.lastPriceUsd,
    payTo: rec.lastPayTo,
    network: rec.lastNetwork,
    reasonCodes: (["served_from_cache", ...rec.lastReasonCodes] as ReasonCode[]).slice(
      0,
      12,
    ),
    history: summarize(rec),
  };
}

/**
 * Paid product path: return compact ToolCheck.
 * Uses cached last live result when fresher than staleMs; otherwise probes live.
 */
export async function checkTool(
  targetUrl: string,
  env: Pick<Env, "PAYTO_HISTORY" | "CACHE_STALE_MS">,
  opts: { forceLive?: boolean } = {},
): Promise<ToolCheck> {
  const now = Date.now();
  const staleMs = Number(env.CACHE_STALE_MS || "45000") || 45_000;
  let normalized: string;
  try {
    normalized = normalizeUrl(targetUrl);
  } catch (e) {
    return {
      url: targetUrl,
      verdict: "avoid",
      checkedAt: new Date(now).toISOString(),
      live: false,
      cacheAgeMs: 0,
      status: null,
      latencyMs: null,
      is402: false,
      priceUsd: null,
      payTo: null,
      network: null,
      reasonCodes: ["unreachable"],
      history: summarize(null),
    };
  }

  const cached = await loadToolRecord(env.PAYTO_HISTORY, normalized);
  if (!opts.forceLive && cached?.lastCheckedAt) {
    const age = now - (Date.parse(cached.lastCheckedAt) || 0);
    if (age >= 0 && age < staleMs) {
      return fromCache(normalized, cached, now);
    }
  }

  const live = await runPreflight(normalized, env, { checkBazaar: false });
  const reasonCodes = live.reasons.map((r) => r.code);
  const primary = live.x402.accepts[0] || null;
  const rec = await recordToolCheck(env.PAYTO_HISTORY, {
    url: normalized,
    at: live.checkedAt,
    verdict: live.verdict,
    status: live.reachability.status,
    latencyMs: live.reachability.latencyMs,
    is402: live.x402.is402,
    priceUsd: live.price.primaryUsd,
    payTo: primary?.payTo || null,
    network: primary?.network || null,
    reasonCodes,
  });

  return {
    url: normalized,
    verdict: live.verdict,
    checkedAt: live.checkedAt,
    live: true,
    cacheAgeMs: 0,
    status: live.reachability.status,
    latencyMs: live.reachability.latencyMs,
    is402: live.x402.is402,
    priceUsd: live.price.primaryUsd,
    payTo: primary?.payTo || null,
    network: primary?.network || null,
    reasonCodes,
    history: summarize(rec),
  };
}
