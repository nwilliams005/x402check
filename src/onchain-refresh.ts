/**
 * Periodic Base USDC Transfer refresh for stats:onchain (cron).
 * Mirrors scripts/seed-stats.mjs eth_getLogs logic; incremental when prior snapshot exists.
 * Aggregates exclude INTERNAL test wallet; transfers list still records them with internalTest.
 */
import type { Env } from "./types";
import {
  ONCHAIN_KEY,
  type OnChainStats,
  type OnChainTransfer,
} from "./stats";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const INTERNAL = "0x514be7314c16063cbfad664eece48d8e7119dd9b";
const TOPIC0 =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEFAULT_RPC = "https://base-rpc.publicnode.com";
/** Lookback when no prior snapshot (~2 days at 2s blocks). */
const DEFAULT_LOOKBACK = 100_000;
/** Cap work per cron tick. */
const MAX_RANGE = 80_000;
const STEP = 4_000;

const CHECK_ATOMICS = new Set([10_000, 50_000, 2_000]); // $0.01 / $0.05 / legacy $0.002

export type OnChainRefreshSummary = {
  ok: boolean;
  added: number;
  paidTransfers: number;
  usdcTotal: number;
  uniquePayers: number;
  internalTestTransfers: number;
  fromBlock: number;
  toBlock: number;
  error?: string;
};

async function rpc(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "x402check-onchain-refresh/0.1",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = (await res.json()) as { result?: unknown; error?: unknown };
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}

function topic2ForPayTo(payTo: string): string {
  return "0x000000000000000000000000" + payTo.slice(2).toLowerCase();
}

function aggregate(transfers: OnChainTransfer[], payTo: string): OnChainStats {
  const paid = transfers.filter(
    (t) => CHECK_ATOMICS.has(t.atomic) && !t.internalTest,
  );
  const internal = transfers.filter(
    (t) => CHECK_ATOMICS.has(t.atomic) && t.internalTest,
  ).length;
  const unique = new Set(paid.map((t) => t.from));
  const usdcTotal = paid.reduce((s, t) => s + t.usdc, 0);
  return {
    paidTransfers: paid.length,
    usdcTotal: Number(usdcTotal.toFixed(6)),
    uniquePayers: unique.size,
    internalTestTransfers: internal,
    asOf: new Date().toISOString(),
    source: "base_usdc_transfers",
    network: "eip155:8453",
    payTo,
    asset: USDC,
    // Keep check-priced transfers only (incl. internal flagged); drop $5 watches.
    transfers: transfers.filter((t) => CHECK_ATOMICS.has(t.atomic)),
  };
}

export async function refreshOnChainStats(
  env: Env,
): Promise<OnChainRefreshSummary> {
  const kv = env.PAYTO_HISTORY;
  const payTo = (env.PAY_TO || "").trim();
  if (!kv || !payTo) {
    return {
      ok: false,
      added: 0,
      paidTransfers: 0,
      usdcTotal: 0,
      uniquePayers: 0,
      internalTestTransfers: 0,
      fromBlock: 0,
      toBlock: 0,
      error: "missing kv or PAY_TO",
    };
  }
  const rpcUrl = DEFAULT_RPC;
  try {
    const existingRaw = await kv.get(ONCHAIN_KEY);
    let existing: OnChainStats | null = null;
    if (existingRaw) {
      try {
        existing = JSON.parse(existingRaw) as OnChainStats;
      } catch {
        existing = null;
      }
    }

    const blockHex = (await rpc(rpcUrl, "eth_blockNumber", [])) as string;
    const tip = parseInt(blockHex, 16);
    const lastBlock =
      existing && Array.isArray(existing.transfers) && existing.transfers.length
        ? Math.max(...existing.transfers.map((t) => t.block))
        : 0;
    let from = lastBlock > 0 ? lastBlock + 1 : Math.max(0, tip - DEFAULT_LOOKBACK);
    if (tip - from > MAX_RANGE) from = tip - MAX_RANGE;
    const to = tip;

    if (from > to) {
      const agg = existing
        ? aggregate(existing.transfers, payTo)
        : aggregate([], payTo);
      await kv.put(ONCHAIN_KEY, JSON.stringify(agg));
      return {
        ok: true,
        added: 0,
        paidTransfers: agg.paidTransfers,
        usdcTotal: agg.usdcTotal,
        uniquePayers: agg.uniquePayers,
        internalTestTransfers: agg.internalTestTransfers,
        fromBlock: from,
        toBlock: to,
      };
    }

    const topic2 = topic2ForPayTo(payTo);
    const logs: Array<{
      topics: string[];
      data: string;
      blockNumber: string;
      transactionHash: string;
    }> = [];
    let step = STEP;
    for (let cur = from; cur <= to; ) {
      const end = Math.min(to, cur + step - 1);
      try {
        const chunk = (await rpc(rpcUrl, "eth_getLogs", [
          {
            address: USDC,
            topics: [TOPIC0, null, topic2],
            fromBlock: "0x" + cur.toString(16),
            toBlock: "0x" + end.toString(16),
          },
        ])) as typeof logs;
        logs.push(...(chunk || []));
        cur = end + 1;
      } catch (e) {
        if (step > 500) {
          step = Math.floor(step / 2);
          continue;
        }
        throw e;
      }
    }

    const byTx = new Map<string, OnChainTransfer>();
    if (existing?.transfers) {
      for (const t of existing.transfers) byTx.set(t.tx.toLowerCase(), t);
    }

    let added = 0;
    for (const L of logs) {
      const fromAddr = ("0x" + L.topics[1].slice(-40)).toLowerCase();
      const atomic = Number(BigInt(L.data));
      const b = parseInt(L.blockNumber, 16);
      const blk = (await rpc(rpcUrl, "eth_getBlockByNumber", [
        "0x" + b.toString(16),
        false,
      ])) as { timestamp: string };
      const at = new Date(parseInt(blk.timestamp, 16) * 1000).toISOString();
      const tx = L.transactionHash;
      const rec: OnChainTransfer = {
        tx,
        block: b,
        from: fromAddr,
        usdc: atomic / 1e6,
        atomic,
        at,
        internalTest: fromAddr === INTERNAL,
      };
      const key = tx.toLowerCase();
      if (!byTx.has(key)) added += 1;
      byTx.set(key, rec);
    }

    const merged = [...byTx.values()].sort((a, b) => a.block - b.block);
    const agg = aggregate(merged, payTo);
    await kv.put(ONCHAIN_KEY, JSON.stringify(agg));
    return {
      ok: true,
      added,
      paidTransfers: agg.paidTransfers,
      usdcTotal: agg.usdcTotal,
      uniquePayers: agg.uniquePayers,
      internalTestTransfers: agg.internalTestTransfers,
      fromBlock: from,
      toBlock: to,
    };
  } catch (e) {
    return {
      ok: false,
      added: 0,
      paidTransfers: 0,
      usdcTotal: 0,
      uniquePayers: 0,
      internalTestTransfers: 0,
      fromBlock: 0,
      toBlock: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
