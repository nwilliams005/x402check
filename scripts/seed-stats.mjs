#!/usr/bin/env node
/**
 * Seed stats:global + stats:onchain from VERIFIED sources only:
 *  - tool:* history records in KV (checks / verdicts)
 *  - Base USDC Transfer logs to payTo (eth_getLogs), cross-checked below
 *
 * Never invents numbers. Re-run after new on-chain payments to refresh the snapshot.
 *
 * Usage:
 *   node scripts/seed-stats.mjs              # dry-run print
 *   node scripts/seed-stats.mjs --write      # PUT to remote KV
 */
const ACCOUNT_ID = "3d713278ffd837b2b46e92d76e30ed24";
const NS_ID = "8f4f73f6432e4020a313131d52bab27d";
const PAY_TO = "0xd98451514c7510e3fCd0463De973B9a6bB89A86f";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const INTERNAL = "0x514be7314c16063cbfad664eece48d8e7119dd9b";
const RPC = process.env.BASE_RPC || "https://base-rpc.publicnode.com";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const WRITE = process.argv.includes("--write");

const TOPIC0 =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const TOPIC2 =
  "0x000000000000000000000000" + PAY_TO.slice(2).toLowerCase();

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "x402check-seed/0.1",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}

async function fetchOnChainTransfers() {
  const blockHex = await rpc("eth_blockNumber", []);
  const block = parseInt(blockHex, 16);
  const start = Math.max(0, block - 250000);
  const logs = [];
  let step = 5000;
  for (let cur = start; cur <= block; ) {
    const end = Math.min(block, cur + step - 1);
    try {
      const chunk = await rpc("eth_getLogs", [
        {
          address: USDC,
          topics: [TOPIC0, null, TOPIC2],
          fromBlock: "0x" + cur.toString(16),
          toBlock: "0x" + end.toString(16),
        },
      ]);
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

  const out = [];
  for (const L of logs) {
    const from = ("0x" + L.topics[1].slice(-40)).toLowerCase();
    const atomic = Number(BigInt(L.data));
    const b = parseInt(L.blockNumber, 16);
    const blk = await rpc("eth_getBlockByNumber", [
      "0x" + b.toString(16),
      false,
    ]);
    const at = new Date(parseInt(blk.timestamp, 16) * 1000).toISOString();
    out.push({
      tx: L.transactionHash,
      block: b,
      from,
      usdc: atomic / 1e6,
      atomic,
      at,
      internalTest: from === INTERNAL,
    });
  }
  out.sort((a, b) => a.block - b.block);
  return out;
}

async function cfKvList(prefix) {
  const u = new URL(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NS_ID}/keys`,
  );
  if (prefix) u.searchParams.set("prefix", prefix);
  const res = await fetch(u, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const j = await res.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors));
  return j.result || [];
}

async function cfKvGet(key) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NS_ID}/values/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`get ${key}: ${res.status}`);
  return await res.text();
}

async function cfKvPut(key, value, expirationTtl) {
  const u = new URL(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NS_ID}/values/${encodeURIComponent(key)}`,
  );
  if (expirationTtl) u.searchParams.set("expiration_ttl", String(expirationTtl));
  const res = await fetch(u, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "content-type": "text/plain",
    },
    body: value,
  });
  const j = await res.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors));
}

function hourKey(iso) {
  return `stats:hour:${iso.slice(0, 13)}`;
}

async function main() {
  if (!TOKEN) throw new Error("CLOUDFLARE_API_TOKEN required");

  console.log("Fetching on-chain USDC transfers to", PAY_TO);
  const transfers = await fetchOnChainTransfers();
  const checkPrice = transfers.filter((t) => t.atomic === 10000 || t.atomic === 50000 || t.atomic === 2000);
  // Count Exact base ($0.01=10000) and deep ($0.05=50000) checks; exclude $5 watches (5000000).
  // Aggregates exclude INTERNAL test wallet; transfers list still includes them flagged.
  const paid = checkPrice.filter((t) => !t.internalTest);
  const unique = new Set(paid.map((t) => t.from));
  const internal = checkPrice.filter((t) => t.internalTest).length;
  const usdcTotal = paid.reduce((s, t) => s + t.usdc, 0);
  const asOf = new Date().toISOString();

  const onChain = {
    paidTransfers: paid.length,
    usdcTotal: Number(usdcTotal.toFixed(6)),
    uniquePayers: unique.size,
    internalTestTransfers: internal,
    asOf,
    source: "base_usdc_transfers",
    network: "eip155:8453",
    payTo: PAY_TO,
    asset: USDC,
    transfers: checkPrice,
  };

  console.log("On-chain check transfers ($0.01/$0.05/legacy $0.002):", paid.length, "usdc", usdcTotal, "wallets", unique.size);

  const toolKeys = await cfKvList("tool:");
  let totalChecks = 0;
  let flaggedOk = 0;
  let flaggedCaution = 0;
  let flaggedAvoid = 0;
  const hourBuckets = new Map();
  const recentIsos = [];

  for (const k of toolKeys) {
    const raw = await cfKvGet(k.name);
    if (!raw) continue;
    const rec = JSON.parse(raw);
    const checks = Number(rec.checks) || 0;
    totalChecks += checks;
    // Prefer recent[] for verdict breakdown when available
    const recent = Array.isArray(rec.recent) ? rec.recent : [];
    if (recent.length) {
      for (const r of recent) {
        if (r.verdict === "ok") flaggedOk += 1;
        else if (r.verdict === "caution") flaggedCaution += 1;
        else if (r.verdict === "avoid") flaggedAvoid += 1;
        if (r.at) {
          recentIsos.push(r.at);
          const hk = hourKey(r.at);
          const b = hourBuckets.get(hk) || { checks: 0, caution: 0, avoid: 0 };
          b.checks += 1;
          if (r.verdict === "caution") b.caution += 1;
          if (r.verdict === "avoid") b.avoid += 1;
          hourBuckets.set(hk, b);
        }
      }
      // If checks > recent.length, we only know recent verdicts; don't invent the rest
      if (checks > recent.length) {
        console.warn(
          `warn: ${k.name} checks=${checks} but recent=${recent.length}; using recent for verdict split only`,
        );
      }
    } else if (rec.lastVerdict === "ok") {
      flaggedOk += checks;
    } else if (rec.lastVerdict === "caution") {
      flaggedCaution += checks;
    } else if (rec.lastVerdict === "avoid") {
      flaggedAvoid += checks;
    }
  }

  // Cross-check: paid on-chain should match tool check count when every check was billed.
  if (totalChecks !== paid.length) {
    console.warn(
      `cross-check: tool history checks=${totalChecks} vs on-chain check transfers=${paid.length}`,
    );
  }

  // Use the tighter verified paid count for paidChecks (on-chain is source of truth for money).
  // totalChecks from tool history (what we actually ran). Prefer equality.
  const paidChecks = paid.length;
  const toolsChecked = toolKeys.length;
  // If recent covered all checks, flagged* already sum to totalChecks.
  // If not, leave flagged as recent-only and do not pad.
  const noteDetail =
    internal > 0
      ? `excludes ${internal} internal test check${internal === 1 ? "" : "s"} from paid counts`
      : null;

  const global = {
    totalChecks,
    paidChecks,
    toolsChecked,
    flaggedOk,
    flaggedCaution,
    flaggedAvoid,
    updatedAt: asOf,
    noteDetail,
  };

  console.log("Seed global:", JSON.stringify(global, null, 2));
  console.log("Hour buckets:", [...hourBuckets.entries()]);
  console.log("On-chain:", JSON.stringify(onChain, null, 2));

  if (!WRITE) {
    console.log("Dry-run only. Pass --write to PUT into remote KV.");
    return;
  }

  await cfKvPut("stats:global", JSON.stringify(global));
  await cfKvPut("stats:onchain", JSON.stringify(onChain));
  for (const [hk, b] of hourBuckets) {
    await cfKvPut(hk, JSON.stringify(b), 60 * 60 * 48);
  }
  console.log("Wrote stats:global, stats:onchain, and", hourBuckets.size, "hour buckets");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
