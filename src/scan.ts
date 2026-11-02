/**
 * Internal ecosystem scanner. Results are NEVER public.
 * Cron probes listed x402 endpoints and stores private grades for
 * verified-owner dashboards only. /scan is an explain/CTA page · no numbers.
 */
import type { Env } from "./types";
import { checkTool, isBlockedHost } from "./preflight";

export type ScanGrade = "pass" | "warn" | "fail";

export type ScanEndpointRecord = {
  /** Normalized absolute URL (private; never expose via public routes). */
  url: string;
  /** sha256 hex of normalized url · KV key suffix */
  urlHash: string;
  grade: ScanGrade;
  gradedAt: string;
  live: boolean;
  is402: boolean;
  status: number | null;
  latencyMs: number | null;
  livePriceUsd: number | null;
  livePayTo: string | null;
  listedPriceUsd: number | null;
  listedPayTo: string | null;
  source: "bazaar" | "402index" | "both" | "unknown";
  reasons: string[];
  /** Snapshot note for owners: this is periodic, not a live paid check. */
  note: string;
};

const SCAN_EP_PREFIX = "scan:ep:";
const SCAN_META_KEY = "scan:meta:v1";
/** Max live probes per cron invocation (Worker time/subrequest budget). */
export const SCAN_BATCH_LIMIT = 25;
const LISTING_FETCH_LIMIT = 40;

export function scanEpKey(urlHash: string): string {
  return `${SCAN_EP_PREFIX}${urlHash}`;
}

export async function hashUrl(url: string): Promise<string> {
  const norm = normalizeScanUrl(url);
  const data = new TextEncoder().encode(norm);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function normalizeScanUrl(url: string): string {
  const u = new URL(url.trim());
  u.hash = "";
  // keep trailing slash policy: strip trailing slash except root
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }
  return u.toString();
}

export async function loadScanRecord(
  kv: KVNamespace,
  urlOrHash: string,
): Promise<ScanEndpointRecord | null> {
  const hash =
    /^[0-9a-f]{64}$/i.test(urlOrHash) ? urlOrHash.toLowerCase() : await hashUrl(urlOrHash);
  const raw = await kv.get(scanEpKey(hash));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ScanEndpointRecord;
  } catch {
    return null;
  }
}

export async function saveScanRecord(
  kv: KVNamespace,
  rec: ScanEndpointRecord,
): Promise<void> {
  await kv.put(scanEpKey(rec.urlHash), JSON.stringify(rec));
}

type ListedEndpoint = {
  url: string;
  listedPriceUsd: number | null;
  listedPayTo: string | null;
  source: "bazaar" | "402index";
};

type MergedListing = {
  url: string;
  listedPriceUsd: number | null;
  listedPayTo: string | null;
  source: "bazaar" | "402index" | "both";
};

async function fetchBazaarSample(): Promise<ListedEndpoint[]> {
  const out: ListedEndpoint[] = [];
  try {
    const u = new URL(
      "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources",
    );
    u.searchParams.set("limit", String(LISTING_FETCH_LIMIT));
    const res = await fetch(u.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "x402check-scan/0.1 (internal cron; read-only)",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return out;
    const data = (await res.json()) as {
      items?: Array<{
        resource?: string;
        url?: string;
        accepts?: Array<{
          resource?: string;
          payTo?: string;
          amount?: string;
          maxAmountRequired?: string;
        }>;
      }>;
    };
    for (const it of data.items || []) {
      const resource =
        it.resource ||
        it.url ||
        it.accepts?.[0]?.resource ||
        "";
      if (!resource || !resource.startsWith("http")) continue;
      const accept = it.accepts?.[0];
      const atomic = accept?.amount ?? accept?.maxAmountRequired ?? null;
      const listedPriceUsd =
        atomic != null && /^\d+$/.test(String(atomic))
          ? Number(atomic) / 1e6
          : null;
      out.push({
        url: resource,
        listedPriceUsd,
        listedPayTo: accept?.payTo ? String(accept.payTo).toLowerCase() : null,
        source: "bazaar",
      });
    }
  } catch {
    /* non-fatal */
  }
  return out;
}

async function fetch402IndexSample(): Promise<ListedEndpoint[]> {
  const out: ListedEndpoint[] = [];
  try {
    const res = await fetch(
      "https://402index.io/api/v1/services?protocol=x402&limit=40&sort=reliability&order=desc",
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "x402check-scan/0.1 (internal cron; read-only)",
        },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) return out;
    const j = (await res.json()) as {
      services?: Array<Record<string, unknown>>;
      data?: Array<Record<string, unknown>>;
    };
    const list = Array.isArray(j.services)
      ? j.services
      : Array.isArray(j.data)
        ? j.data
        : [];
    for (const s of list) {
      const url = typeof s.url === "string" ? s.url : "";
      if (!url.startsWith("http")) continue;
      const price =
        typeof s.price_usd === "number"
          ? s.price_usd
          : typeof s.priceUsd === "number"
            ? s.priceUsd
            : null;
      // 402 Index rarely exposes payTo in list; leave null
      out.push({
        url,
        listedPriceUsd: price,
        listedPayTo: null,
        source: "402index",
      });
    }
  } catch {
    /* non-fatal */
  }
  return out;
}

function mergeListingsProper(
  a: ListedEndpoint[],
  b: ListedEndpoint[],
): MergedListing[] {
  const map = new Map<string, MergedListing>();
  for (const item of [...a, ...b]) {
    let norm: string;
    try {
      norm = normalizeScanUrl(item.url);
    } catch {
      continue;
    }
    const prev = map.get(norm);
    if (!prev) {
      map.set(norm, { ...item, url: norm, source: item.source });
      continue;
    }
    map.set(norm, {
      url: norm,
      listedPriceUsd: prev.listedPriceUsd ?? item.listedPriceUsd,
      listedPayTo: prev.listedPayTo ?? item.listedPayTo,
      source: prev.source !== item.source ? "both" : prev.source,
    });
  }
  return [...map.values()];
}

export function gradeEndpoint(input: {
  live: boolean;
  is402: boolean;
  status: number | null;
  livePriceUsd: number | null;
  livePayTo: string | null;
  listedPriceUsd: number | null;
  listedPayTo: string | null;
}): { grade: ScanGrade; reasons: string[] } {
  const reasons: string[] = [];
  let fail = false;
  let warn = false;

  if (!input.live || input.status == null || input.status <= 0) {
    reasons.push("unreachable");
    fail = true;
  } else if (!input.is402 && input.status !== 402) {
    reasons.push("not_402");
    warn = true;
  } else {
    reasons.push("uptime_ok");
  }

  if (
    input.listedPriceUsd != null &&
    input.livePriceUsd != null &&
    Number.isFinite(input.listedPriceUsd) &&
    Number.isFinite(input.livePriceUsd)
  ) {
    const listed = input.listedPriceUsd;
    const live = input.livePriceUsd;
    const abs = Math.abs(listed - live);
    const rel = listed === 0 ? abs : abs / Math.abs(listed);
    if (abs > 0.000001 && rel > 0.05) {
      reasons.push("price_mismatch");
      // large mismatch → fail; small-moderate → warn (already >5%)
      if (rel > 0.5 || abs > 1) fail = true;
      else warn = true;
    } else {
      reasons.push("price_match");
    }
  } else if (input.listedPriceUsd != null && input.livePriceUsd == null && input.is402) {
    reasons.push("price_unparsed");
    warn = true;
  }

  if (input.listedPayTo && input.livePayTo) {
    if (input.listedPayTo.toLowerCase() !== input.livePayTo.toLowerCase()) {
      reasons.push("payto_mismatch");
      fail = true;
    } else {
      reasons.push("payto_match");
    }
  }

  if (fail) return { grade: "fail", reasons };
  if (warn) return { grade: "warn", reasons };
  return { grade: "pass", reasons };
}

export type ScanCronSummary = {
  listed: number;
  probed: number;
  passed: number;
  warned: number;
  failed: number;
  errors: number;
  cursor: number;
};

/**
 * Probe a batch of listed endpoints and store private grades.
 * Uses a rotating cursor in scan:meta so we cover the catalog over time.
 */
export async function runScanCron(env: Env): Promise<ScanCronSummary> {
  const summary: ScanCronSummary = {
    listed: 0,
    probed: 0,
    passed: 0,
    warned: 0,
    failed: 0,
    errors: 0,
    cursor: 0,
  };

  const [bazaar, index402] = await Promise.all([
    fetchBazaarSample(),
    fetch402IndexSample(),
  ]);
  const listed = mergeListingsProper(bazaar, index402).filter((x) => {
    try {
      return !isBlockedHost(x.url);
    } catch {
      return false;
    }
  });
  summary.listed = listed.length;

  let meta: { cursor: number; updatedAt: string } = {
    cursor: 0,
    updatedAt: new Date().toISOString(),
  };
  try {
    const raw = await env.PAYTO_HISTORY.get(SCAN_META_KEY);
    if (raw) meta = { ...meta, ...(JSON.parse(raw) as typeof meta) };
  } catch {
    /* start at 0 */
  }

  const start = listed.length ? meta.cursor % listed.length : 0;
  const batch: typeof listed = [];
  for (let i = 0; i < Math.min(SCAN_BATCH_LIMIT, listed.length); i++) {
    batch.push(listed[(start + i) % listed.length]);
  }
  summary.cursor = listed.length
    ? (start + batch.length) % listed.length
    : 0;

  for (const item of batch) {
    try {
      const check = await checkTool(item.url, env, { forceLive: true });
      const { grade, reasons } = gradeEndpoint({
        live: check.live && check.status != null && check.status > 0,
        is402: check.is402,
        status: check.status,
        livePriceUsd: check.priceUsd,
        livePayTo: check.payTo,
        listedPriceUsd: item.listedPriceUsd,
        listedPayTo: item.listedPayTo,
      });
      const urlHash = await hashUrl(item.url);
      const rec: ScanEndpointRecord = {
        url: normalizeScanUrl(item.url),
        urlHash,
        grade,
        gradedAt: check.checkedAt,
        live: check.live,
        is402: check.is402,
        status: check.status,
        latencyMs: check.latencyMs,
        livePriceUsd: check.priceUsd,
        livePayTo: check.payTo,
        listedPriceUsd: item.listedPriceUsd,
        listedPayTo: item.listedPayTo,
        source: item.source,
        reasons,
        note:
          "Periodic internal snapshot for verified owners. Live agent verification still requires a paid /preflight check.",
      };
      await saveScanRecord(env.PAYTO_HISTORY, rec);
      summary.probed += 1;
      if (grade === "pass") summary.passed += 1;
      else if (grade === "warn") summary.warned += 1;
      else summary.failed += 1;
    } catch {
      summary.errors += 1;
    }
  }

  await env.PAYTO_HISTORY.put(
    SCAN_META_KEY,
    JSON.stringify({
      cursor: summary.cursor,
      updatedAt: new Date().toISOString(),
      lastProbed: summary.probed,
      lastListed: summary.listed,
    }),
  );

  return summary;
}

/** Dead exports so we don't accidentally ship a public aggregate helper. */
export function publicScanAggregatesForbidden(): never {
  throw new Error(
    "Scan aggregates are not public. Results are owner-dashboard only.",
  );
}

