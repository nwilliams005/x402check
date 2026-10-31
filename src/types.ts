export type Verdict = "ok" | "caution" | "avoid";

export type ReasonCode =
  | "reachable"
  | "unreachable"
  | "slow_latency"
  | "tls_ok"
  | "tls_issue"
  | "http_402"
  | "not_402"
  | "valid_payment_requirements"
  | "invalid_payment_requirements"
  | "price_high_for_category"
  | "price_ok"
  | "payto_changed"
  | "payto_stable"
  | "payto_first_seen"
  | "listed_in_bazaar"
  | "not_listed_in_bazaar"
  | "bazaar_check_skipped"
  | "bazaar_check_failed"
  | "method_hint_post"
  | "served_from_cache";

export interface Reason {
  code: ReasonCode;
  severity: "info" | "warn" | "critical";
  message: string;
}

export interface AcceptOffer {
  scheme: string;
  network: string;
  amountAtomic: string;
  amountUsd: number | null;
  asset: string;
  assetName?: string;
  payTo: string;
  maxTimeoutSeconds?: number;
}

/** Compact per-tool trust report (stable field names). */
export interface ToolCheck {
  url: string;
  verdict: Verdict;
  checkedAt: string;
  /** true when a live probe ran this request */
  live: boolean;
  /** ms since last live probe in history (0 if just probed) */
  cacheAgeMs: number;
  status: number | null;
  latencyMs: number | null;
  is402: boolean;
  priceUsd: number | null;
  payTo: string | null;
  network: string | null;
  reasonCodes: ReasonCode[];
  history: ToolHistorySummary;
}

export interface ToolHistorySummary {
  checks: number;
  uptimePct: number | null;
  lastOkAt: string | null;
  lastFailAt: string | null;
  payToChanges: Array<{ at: string; from: string; to: string }>;
  priceChanges: Array<{ at: string; fromUsd: number | null; toUsd: number | null }>;
  recent: Array<{
    at: string;
    verdict: Verdict;
    status: number | null;
    priceUsd: number | null;
    payTo: string | null;
  }>;
}

export interface BatchResult {
  results: ToolCheck[];
  chargedTools: number;
  pricePerToolUsd: number;
  totalUsd: number;
  elapsedMs: number;
}

export interface Env {
  PAY_TO: string;
  NETWORK: string;
  /** Unit price string for docs; dynamic pricing uses PRICE_PER_TOOL_USD */
  PRICE: string;
  PRICE_PER_TOOL_USD: string;
  /** Cache freshness window in ms (default 45000) */
  CACHE_STALE_MS: string;
  FACILITATOR_URL: string;
  ALLOW_LOCAL_BYPASS: string;
  SERVICE_NAME: string;
  CDP_API_KEY_ID?: string;
  CDP_API_KEY_SECRET?: string;
  PAYTO_HISTORY: KVNamespace;
}

/** Legacy verbose shape kept for internal probe; not returned to clients. */
export interface PreflightResult {
  verdict: Verdict;
  checkedAt: string;
  targetUrl: string;
  reachability: {
    ok: boolean;
    status: number | null;
    latencyMs: number | null;
    error: string | null;
  };
  tls: { ok: boolean | null; note: string };
  x402: {
    is402: boolean;
    x402Version: number | null;
    description: string | null;
    serviceName: string | null;
    accepts: AcceptOffer[];
    hasBazaarExtension: boolean;
    rawError: string | null;
  };
  price: {
    primaryUsd: number | null;
    category: string;
    highForCategory: boolean;
    categoryTypicalMaxUsd: number;
  };
  payToHistory: {
    current: string | null;
    previous: string | null;
    changed: boolean;
    firstSeen: boolean;
    lastSeenAt: string | null;
  };
  bazaar: {
    checked: boolean;
    listed: boolean | null;
    matchCount: number | null;
    note: string;
  };
  reasons: Reason[];
  disclaimer: string;
}
