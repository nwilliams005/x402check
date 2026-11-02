/**
 * Deep check ($0.05): base preflight plus checks we can really run from a
 * Worker — repeated live probes for payTo/price consistency, recent public
 * Base USDC Transfer logs into the seller payTo, Bazaar + 402 Index listing
 * samples, and drift vs the last KV history for the URL. No OFAC, no wallet
 * simulation, no facilitator-private settlement claims.
 */
import type { Env, ToolCheck } from "./types";
import { checkTool, isBlockedHost } from "./preflight";
import { checkBazaarListing, type BazaarCheck } from "./bazaar";
import { loadToolRecord } from "./history";
import {
  DEEP_CHECK_PRICE_USD,
  WATCH_DURATION_DAYS,
  WATCH_PRICE_USD,
} from "./sell";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const BASE_RPC = "https://base-rpc.publicnode.com";
/** ~11h of Base blocks at ~2s; keep Worker time bounded. */
const RECENT_BLOCKS = 20_000;
const CHUNK = 5_000;
const MAX_TRANSFERS = 15;
const EXTRA_PROBES = 2;

export type DeepTransfer = {
  tx: string;
  block: number;
  from: string;
  atomic: number;
  usdc: number;
};

export type DeepCheckResult = ToolCheck & {
  deep: true;
  chargedUsd: number;
  bazaar: BazaarCheck;
  watchHint: string;
  deepHint?: undefined;
  priceConsistency: {
    probes: number;
    payToValues: string[];
    priceValues: Array<number | null>;
    payToStable: boolean;
    priceStable: boolean;
    note: string;
  };
  onChainPayTo: {
    network: "eip155:8453";
    asset: "USDC";
    payTo: string | null;
    lookbackBlocks: number;
    transferCount: number;
    transfers: DeepTransfer[];
    totalUsdcInWindow: number;
    note: string;
    error?: string;
  };
  listings: {
    bazaar: BazaarCheck;
    index402: {
      searched: boolean;
      matched: boolean;
      sample?: Record<string, unknown> | null;
      note: string;
      error?: string;
    };
  };
  driftVsLast: {
    compared: boolean;
    payToChanged: boolean | null;
    priceChanged: boolean | null;
    previousPayTo: string | null;
    previousPriceUsd: number | null;
    note: string;
  };
};

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(BASE_RPC, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "x402check-deep/0.3",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Base RPC HTTP ${res.status}`);
  const j = (await res.json()) as {
    result?: unknown;
    error?: { message?: string };
  };
  if (j.error) throw new Error(j.error.message || "rpc error");
  return j.result;
}

async function recentUsdcToPayTo(payTo: string): Promise<{
  transfers: DeepTransfer[];
  lookbackBlocks: number;
  error?: string;
}> {
  try {
    const blockHex = (await rpc("eth_blockNumber", [])) as string;
    const block = parseInt(blockHex, 16);
    const start = Math.max(0, block - RECENT_BLOCKS);
    const topic2 = "0x" + "0".repeat(24) + payTo.slice(2).toLowerCase();
    const logs: Array<{
      transactionHash: string;
      blockNumber: string;
      topics: string[];
      data: string;
    }> = [];
    let step = CHUNK;
    for (let cur = start; cur <= block; ) {
      const end = Math.min(block, cur + step - 1);
      try {
        const chunk = (await rpc("eth_getLogs", [
          {
            address: USDC_BASE,
            topics: [TRANSFER_TOPIC, null, topic2],
            fromBlock: "0x" + cur.toString(16),
            toBlock: "0x" + end.toString(16),
          },
        ])) as typeof logs;
        logs.push(...(chunk || []));
        cur = end + 1;
      } catch {
        if (step > 1000) {
          step = Math.floor(step / 2);
          continue;
        }
        throw new Error("eth_getLogs failed after shrinking window");
      }
    }
    const transfers: DeepTransfer[] = logs
      .slice(-MAX_TRANSFERS)
      .map((L) => {
        const from = ("0x" + L.topics[1].slice(-40)).toLowerCase();
        const atomic = Number(BigInt(L.data));
        return {
          tx: L.transactionHash,
          block: parseInt(L.blockNumber, 16),
          from,
          atomic,
          usdc: atomic / 1e6,
        };
      })
      .reverse();
    return { transfers, lookbackBlocks: block - start };
  } catch (e) {
    return {
      transfers: [],
      lookbackBlocks: RECENT_BLOCKS,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function check402Index(
  url: string,
): Promise<DeepCheckResult["listings"]["index402"]> {
  try {
    const host = new URL(url).hostname;
    const endpoints = [
      `https://402index.io/api/v1/services?q=${encodeURIComponent(host)}&limit=10`,
      `https://www.402index.io/api/v1/services?q=${encodeURIComponent(host)}&limit=10`,
    ];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          headers: {
            accept: "application/json",
            "user-agent": "x402check-deep/0.3",
          },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const j = (await res.json()) as Record<string, unknown>;
        const list = Array.isArray(j.data)
          ? (j.data as Array<Record<string, unknown>>)
          : Array.isArray(j.services)
            ? (j.services as Array<Record<string, unknown>>)
            : Array.isArray(j)
              ? (j as Array<Record<string, unknown>>)
              : [];
        const matched = list.find((s) => {
          const blob = JSON.stringify(s).toLowerCase();
          return (
            blob.includes(host.toLowerCase()) ||
            blob.includes(url.toLowerCase())
          );
        });
        return {
          searched: true,
          matched: !!matched,
          sample: matched
            ? {
                id: matched.id ?? matched.slug ?? matched.name ?? null,
                url:
                  matched.url ?? matched.endpoint ?? matched.resource ?? null,
                price: matched.price ?? matched.amount ?? null,
              }
            : list[0]
              ? {
                  id: list[0].id ?? list[0].slug ?? null,
                  note: "First result in q=host search; not an exact URL match",
                }
              : null,
          note: matched
            ? "Host/URL appears in a 402 Index services search sample."
            : list.length
              ? "402 Index search returned rows but none clearly matched this URL."
              : "402 Index search returned no rows for this host.",
        };
      } catch {
        continue;
      }
    }
    return {
      searched: true,
      matched: false,
      sample: null,
      note: "402 Index public search did not return a usable JSON response.",
    };
  } catch (e) {
    return {
      searched: false,
      matched: false,
      sample: null,
      note: "Could not query 402 Index.",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function watchUpsellHint(): string {
  return `Optional: POST /watch (or MCP watch_tool) — $${WATCH_PRICE_USD} Exact USDC for ${WATCH_DURATION_DAYS} days of daily re-checks with webhook/email on payTo/price/network change. Same Base USDC rails. Not required for one-shot checks.`;
}

export function deepUpsellHint(origin?: string): string {
  const path = origin ? `${origin}/preflight/deep` : "/preflight/deep";
  return `Want more signal? GET ${path} (or MCP deep_check) runs repeated probes, a recent public Base USDC-to-payTo sample, Bazaar/402 Index listing checks, and drift vs last KV history — $${DEEP_CHECK_PRICE_USD} Exact USDC. Optional.`;
}

/**
 * Run a deep check. Caller handles payment / billing.
 */
function normalizeUrl(targetUrl: string): string {
  const u = new URL(targetUrl.trim());
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) URLs allowed");
  }
  return u.toString();
}

export async function deepCheck(
  url: string,
  env: Env,
): Promise<DeepCheckResult> {
  if (isBlockedHost(url)) {
    throw new Error("blocked host");
  }
  const normalized = normalizeUrl(url);

  const prior = await loadToolRecord(env.PAYTO_HISTORY, normalized).catch(() => null);

  const base = await checkTool(normalized, env, { forceLive: true });

  const payToValues: string[] = [];
  const priceValues: Array<number | null> = [];
  if (base.payTo) payToValues.push(base.payTo.toLowerCase());
  priceValues.push(typeof base.priceUsd === "number" ? base.priceUsd : null);

  for (let i = 0; i < EXTRA_PROBES; i++) {
    await sleep(250);
    const probe = await checkTool(normalized, env, { forceLive: true });
    if (probe.payTo) payToValues.push(probe.payTo.toLowerCase());
    priceValues.push(typeof probe.priceUsd === "number" ? probe.priceUsd : null);
  }

  const uniquePayTo = [...new Set(payToValues.filter(Boolean))];
  const numericPrices = priceValues.filter((p): p is number => p != null);
  const uniquePrices = [...new Set(numericPrices.map((p) => p.toFixed(6)))];
  const payToStable = uniquePayTo.length <= 1;
  const priceStable = uniquePrices.length <= 1;

  const onChain = base.payTo
    ? await recentUsdcToPayTo(base.payTo)
    : {
        transfers: [] as DeepTransfer[],
        lookbackBlocks: 0,
        error: undefined as string | undefined,
      };

  const [bazaar, index402] = await Promise.all([
    checkBazaarListing(normalized),
    check402Index(normalized),
  ]);

  const previousPayTo = prior?.lastPayTo || null;
  const previousPriceUsd =
    typeof prior?.lastPriceUsd === "number" ? prior.lastPriceUsd : null;
  let payToChanged: boolean | null = null;
  if (previousPayTo && base.payTo) {
    payToChanged = previousPayTo.toLowerCase() !== base.payTo.toLowerCase();
  } else if (previousPayTo && !base.payTo) {
    payToChanged = true;
  }
  let priceChanged: boolean | null = null;
  if (previousPriceUsd != null && base.priceUsd != null) {
    priceChanged = Math.abs(previousPriceUsd - base.priceUsd) > 1e-9;
  } else if (previousPriceUsd != null && base.priceUsd == null) {
    priceChanged = true;
  }

  try {
    await env.PAYTO_HISTORY.put(
      `deep:${normalized}`,
      JSON.stringify({
        at: new Date().toISOString(),
        payTo: base.payTo,
        priceUsd: base.priceUsd,
        verdict: base.verdict,
        payToStable,
        priceStable,
        onChainCount: onChain.transfers.length,
        bazaarListed: bazaar.listed,
        index402Matched: index402.matched,
      }),
      { expirationTtl: 60 * 60 * 24 * 90 },
    );
  } catch {
    /* non-fatal */
  }

  return {
    ...base,
    deep: true,
    chargedUsd: DEEP_CHECK_PRICE_USD,
    bazaar,
    watchHint: watchUpsellHint(),
    priceConsistency: {
      probes: 1 + EXTRA_PROBES,
      payToValues: uniquePayTo,
      priceValues,
      payToStable,
      priceStable,
      note:
        payToStable && priceStable
          ? "Repeated live probes returned the same payTo and price."
          : "Repeated live probes disagreed on payTo and/or price — treat as unstable.",
    },
    onChainPayTo: {
      network: "eip155:8453",
      asset: "USDC",
      payTo: base.payTo,
      lookbackBlocks: onChain.lookbackBlocks,
      transferCount: onChain.transfers.length,
      transfers: onChain.transfers,
      totalUsdcInWindow: onChain.transfers.reduce((s, t) => s + t.usdc, 0),
      note: base.payTo
        ? "Public Base USDC Transfer logs with this payTo as recipient over a recent block window. Not a full history and not proof of x402 specifically — any USDC inbound transfer counts."
        : "No payTo from the live 402 challenge, so on-chain sample was skipped.",
      error: onChain.error,
    },
    listings: {
      bazaar,
      index402,
    },
    driftVsLast: {
      compared: !!(previousPayTo || previousPriceUsd != null),
      payToChanged,
      priceChanged,
      previousPayTo,
      previousPriceUsd,
      note:
        previousPayTo || previousPriceUsd != null
          ? "Compared to the last stored check for this URL in KV history (before this deep run's probes)."
          : "No prior KV history for this URL — first deep sighting.",
    },
  };
}
