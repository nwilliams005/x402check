/**
 * Aggregate live stats from our own KV (never fabricated).
 * Keys live alongside tool history on PAYTO_HISTORY.
 *
 * Optional stats:onchain holds a verified Base USDC Transfer snapshot to payTo
 * (seeded by scripts/seed-stats.mjs after eth_getLogs). Never invent numbers.
 */
export type StatsSnapshot = {
  totalChecks: number;
  paidChecks: number;
  toolsChecked: number;
  flaggedOk: number;
  flaggedCaution: number;
  flaggedAvoid: number;
  last24hChecks: number;
  last24hCaution: number;
  last24hAvoid: number;
  updatedAt: string | null;
  /** Present when a verified on-chain snapshot exists in KV. */
  onChain?: OnChainStats | null;
  /** Honest footnote for the landing page /stats note. */
  noteDetail?: string | null;
};

export type OnChainTransfer = {
  tx: string;
  block: number;
  from: string;
  usdc: number;
  atomic: number;
  at: string;
  internalTest: boolean;
};

export type OnChainStats = {
  paidTransfers: number;
  usdcTotal: number;
  uniquePayers: number;
  internalTestTransfers: number;
  asOf: string;
  source: "base_usdc_transfers";
  network: "eip155:8453";
  payTo: string;
  asset: string;
  transfers: OnChainTransfer[];
};

const GLOBAL_KEY = "stats:global";
const HOUR_PREFIX = "stats:hour:";
export const ONCHAIN_KEY = "stats:onchain";

type GlobalCounters = {
  totalChecks: number;
  paidChecks: number;
  toolsChecked: number;
  flaggedOk: number;
  flaggedCaution: number;
  flaggedAvoid: number;
  updatedAt: string | null;
  /** Optional footnote set by seed (e.g. includes N internal test checks). */
  noteDetail?: string | null;
};

type HourBucket = {
  checks: number;
  caution: number;
  avoid: number;
};

function emptyGlobal(): GlobalCounters {
  return {
    totalChecks: 0,
    paidChecks: 0,
    toolsChecked: 0,
    flaggedOk: 0,
    flaggedCaution: 0,
    flaggedAvoid: 0,
    updatedAt: null,
    noteDetail: null,
  };
}

function hourKey(d = new Date()): string {
  const iso = d.toISOString();
  // YYYY-MM-DDTHH
  return `${HOUR_PREFIX}${iso.slice(0, 13)}`;
}

/** Exported for seed scripts / tests. */
export function hourKeyFor(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return hourKey(d);
}

export async function loadOnChainStats(
  kv: KVNamespace | undefined,
): Promise<OnChainStats | null> {
  if (!kv) return null;
  const raw = await kv.get(ONCHAIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OnChainStats;
  } catch {
    return null;
  }
}

export async function loadStats(
  kv: KVNamespace | undefined,
): Promise<StatsSnapshot> {
  if (!kv) {
    return {
      ...emptyGlobal(),
      last24hChecks: 0,
      last24hCaution: 0,
      last24hAvoid: 0,
      onChain: null,
      noteDetail: null,
    };
  }
  const raw = await kv.get(GLOBAL_KEY);
  let g = emptyGlobal();
  if (raw) {
    try {
      g = { ...emptyGlobal(), ...(JSON.parse(raw) as GlobalCounters) };
    } catch {
      /* keep empty */
    }
  }

  let last24hChecks = 0;
  let last24hCaution = 0;
  let last24hAvoid = 0;
  const now = Date.now();
  // Sum last 24 hour buckets (inclusive of current hour).
  for (let i = 0; i < 24; i++) {
    const d = new Date(now - i * 3_600_000);
    const key = hourKey(d);
    const hRaw = await kv.get(key);
    if (!hRaw) continue;
    try {
      const h = JSON.parse(hRaw) as HourBucket;
      last24hChecks += Number(h.checks) || 0;
      last24hCaution += Number(h.caution) || 0;
      last24hAvoid += Number(h.avoid) || 0;
    } catch {
      /* skip bad bucket */
    }
  }

  const onChain = await loadOnChainStats(kv);

  return {
    totalChecks: g.totalChecks,
    paidChecks: g.paidChecks,
    toolsChecked: g.toolsChecked,
    flaggedOk: g.flaggedOk,
    flaggedCaution: g.flaggedCaution,
    flaggedAvoid: g.flaggedAvoid,
    last24hChecks,
    last24hCaution,
    last24hAvoid,
    updatedAt: g.updatedAt,
    onChain,
    noteDetail: g.noteDetail ?? null,
  };
}

export type RecordCheckOpts = {
  verdict: "ok" | "caution" | "avoid";
  /** true when this response was billed (not local bypass / not internal cron). */
  paid: boolean;
  /** true when this URL had no prior tool record (first time we saw it). */
  isNewTool?: boolean;
};

/**
 * Increment aggregate counters after a completed check response.
 * RMW on KV · approximate under concurrency; never pads numbers.
 */
export async function recordCheckStats(
  kv: KVNamespace | undefined,
  opts: RecordCheckOpts,
): Promise<void> {
  if (!kv) return;
  const at = new Date().toISOString();
  const raw = await kv.get(GLOBAL_KEY);
  let g = emptyGlobal();
  if (raw) {
    try {
      g = { ...emptyGlobal(), ...(JSON.parse(raw) as GlobalCounters) };
    } catch {
      /* reset */
    }
  }
  g.totalChecks += 1;
  if (opts.paid) g.paidChecks += 1;
  if (opts.isNewTool) g.toolsChecked += 1;
  if (opts.verdict === "ok") g.flaggedOk += 1;
  else if (opts.verdict === "caution") g.flaggedCaution += 1;
  else g.flaggedAvoid += 1;
  g.updatedAt = at;
  await kv.put(GLOBAL_KEY, JSON.stringify(g));

  const hk = hourKey(new Date(at));
  const hRaw = await kv.get(hk);
  let h: HourBucket = { checks: 0, caution: 0, avoid: 0 };
  if (hRaw) {
    try {
      h = { ...h, ...(JSON.parse(hRaw) as HourBucket) };
    } catch {
      /* reset */
    }
  }
  h.checks += 1;
  if (opts.verdict === "caution") h.caution += 1;
  if (opts.verdict === "avoid") h.avoid += 1;
  // Keep hourly buckets ~2 days
  await kv.put(hk, JSON.stringify(h), { expirationTtl: 60 * 60 * 48 });
}

/** Pure helper for unit tests / formatting. */
export function formatStatsLine(s: StatsSnapshot): string {
  return `${s.totalChecks} checks · ${s.paidChecks} paid · ${s.toolsChecked} tools · ${s.flaggedCaution} caution · ${s.flaggedAvoid} avoid · last 24h ${s.last24hChecks}`;
}

export function formatOnChainLine(o: OnChainStats): string {
  return `${o.paidTransfers} paid on-chain · $${o.usdcTotal.toFixed(3)} USDC · ${o.uniquePayers} wallets`;
}
