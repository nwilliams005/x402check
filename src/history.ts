import type { ToolHistorySummary, Verdict } from "./types";

const MAX_RECENT = 12;
const MAX_CHANGES = 8;

export interface ToolRecord {
  url: string;
  checks: number;
  okCount: number;
  lastOkAt: string | null;
  lastFailAt: string | null;
  lastCheckedAt: string | null;
  lastVerdict: Verdict | null;
  lastStatus: number | null;
  lastLatencyMs: number | null;
  lastIs402: boolean;
  lastPriceUsd: number | null;
  lastPayTo: string | null;
  lastNetwork: string | null;
  lastReasonCodes: string[];
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

function keyFor(url: string): string {
  return `tool:${url}`;
}

export async function loadToolRecord(
  kv: KVNamespace | undefined,
  url: string,
): Promise<ToolRecord | null> {
  if (!kv) return null;
  const raw = await kv.get(keyFor(url));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ToolRecord;
  } catch {
    return null;
  }
}

export function summarize(rec: ToolRecord | null): ToolHistorySummary {
  if (!rec) {
    return {
      checks: 0,
      uptimePct: null,
      lastOkAt: null,
      lastFailAt: null,
      payToChanges: [],
      priceChanges: [],
      recent: [],
    };
  }
  return {
    checks: rec.checks,
    uptimePct: rec.checks > 0 ? Math.round((rec.okCount / rec.checks) * 1000) / 10 : null,
    lastOkAt: rec.lastOkAt,
    lastFailAt: rec.lastFailAt,
    payToChanges: rec.payToChanges.slice(0, MAX_CHANGES),
    priceChanges: rec.priceChanges.slice(0, MAX_CHANGES),
    recent: rec.recent.slice(0, MAX_RECENT),
  };
}

export async function recordToolCheck(
  kv: KVNamespace | undefined,
  input: {
    url: string;
    at: string;
    verdict: Verdict;
    status: number | null;
    latencyMs: number | null;
    is402: boolean;
    priceUsd: number | null;
    payTo: string | null;
    network: string | null;
    reasonCodes: string[];
  },
): Promise<ToolRecord> {
  const existing = await loadToolRecord(kv, input.url);
  const ok = input.verdict === "ok";
  const payToChanges = [...(existing?.payToChanges || [])];
  const priceChanges = [...(existing?.priceChanges || [])];

  if (
    input.payTo &&
    existing?.lastPayTo &&
    existing.lastPayTo.toLowerCase() !== input.payTo.toLowerCase()
  ) {
    payToChanges.unshift({
      at: input.at,
      from: existing.lastPayTo,
      to: input.payTo,
    });
  }
  if (
    existing &&
    existing.lastPriceUsd != null &&
    input.priceUsd != null &&
    existing.lastPriceUsd !== input.priceUsd
  ) {
    priceChanges.unshift({
      at: input.at,
      fromUsd: existing.lastPriceUsd,
      toUsd: input.priceUsd,
    });
  }

  const recent = [
    {
      at: input.at,
      verdict: input.verdict,
      status: input.status,
      priceUsd: input.priceUsd,
      payTo: input.payTo,
    },
    ...(existing?.recent || []),
  ].slice(0, MAX_RECENT);

  const rec: ToolRecord = {
    url: input.url,
    checks: (existing?.checks || 0) + 1,
    okCount: (existing?.okCount || 0) + (ok ? 1 : 0),
    lastOkAt: ok ? input.at : existing?.lastOkAt || null,
    lastFailAt: ok ? existing?.lastFailAt || null : input.at,
    lastCheckedAt: input.at,
    lastVerdict: input.verdict,
    lastStatus: input.status,
    lastLatencyMs: input.latencyMs,
    lastIs402: input.is402,
    lastPriceUsd: input.priceUsd,
    lastPayTo: input.payTo,
    lastNetwork: input.network,
    lastReasonCodes: input.reasonCodes,
    payToChanges: payToChanges.slice(0, MAX_CHANGES),
    priceChanges: priceChanges.slice(0, MAX_CHANGES),
    recent,
  };

  if (kv) await kv.put(keyFor(input.url), JSON.stringify(rec));
  return rec;
}

/** Legacy payTo-only helpers kept for migration of older KV keys (no-op readers). */
export async function loadPayToHistory() {
  return null;
}
export async function savePayToSighting() {
  return {
    current: null as string | null,
    previous: null as string | null,
    changed: false,
    firstSeen: true,
    lastSeenAt: null as string | null,
  };
}
