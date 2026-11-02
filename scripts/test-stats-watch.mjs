#!/usr/bin/env node
/**
 * Unit tests for stats + watch (no network / no wrangler).
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  formatOnChainLine,
  formatStatsLine,
  loadOnChainStats,
  loadStats,
  recordCheckStats,
  ONCHAIN_KEY,
} from "../src/stats.ts";
import {
  WATCH_PRICE_ATOMIC,
  WATCH_PRICE_USD,
  baselineFromCheck,
  diffBaseline,
  watchAcceptRequirement,
  watchKey,
  formatBaselineLine,
  sendWatchEmail,
} from "../src/watch.ts";

function memoryKv() {
  const store = new Map();
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value, _opts) {
      store.set(key, value);
    },
    async list({ prefix, cursor, limit = 100 } = {}) {
      const keys = [...store.keys()]
        .filter((k) => !prefix || k.startsWith(prefix))
        .sort()
        .map((name) => ({ name }));
      return { keys: keys.slice(0, limit), list_complete: true, cursor: undefined };
    },
    _store: store,
  };
}

test("formatStatsLine is honest and stable", () => {
  const line = formatStatsLine({
    totalChecks: 4,
    paidChecks: 2,
    toolsChecked: 3,
    flaggedOk: 1,
    flaggedCaution: 2,
    flaggedAvoid: 1,
    last24hChecks: 2,
    last24hCaution: 1,
    last24hAvoid: 0,
    updatedAt: "2026-11-01T00:00:00.000Z",
  });
  assert.match(line, /4 checks/);
  assert.match(line, /2 paid/);
  assert.match(line, /3 tools/);
  assert.match(line, /2 caution/);
  assert.match(line, /1 avoid/);
  assert.match(line, /last 24h 2/);
});

test("recordCheckStats + loadStats round-trip (no padding)", async () => {
  const kv = memoryKv();
  let s = await loadStats(kv);
  assert.equal(s.totalChecks, 0);
  assert.equal(s.paidChecks, 0);
  assert.equal(s.toolsChecked, 0);

  await recordCheckStats(kv, { verdict: "ok", paid: true, isNewTool: true });
  await recordCheckStats(kv, {
    verdict: "caution",
    paid: true,
    isNewTool: false,
  });
  await recordCheckStats(kv, {
    verdict: "avoid",
    paid: false,
    isNewTool: true,
  });

  s = await loadStats(kv);
  assert.equal(s.totalChecks, 3);
  assert.equal(s.paidChecks, 2);
  assert.equal(s.toolsChecked, 2);
  assert.equal(s.flaggedOk, 1);
  assert.equal(s.flaggedCaution, 1);
  assert.equal(s.flaggedAvoid, 1);
  assert.equal(s.last24hChecks, 3);
  assert.equal(s.last24hCaution, 1);
  assert.equal(s.last24hAvoid, 1);
  assert.ok(s.updatedAt);
});

test("loadStats without kv returns zeros", async () => {
  const s = await loadStats(undefined);
  assert.equal(s.totalChecks, 0);
  assert.equal(s.last24hChecks, 0);
});

test("diffBaseline detects payTo/price/network/availability", () => {
  const a = {
    payTo: "0xabc",
    priceUsd: 0.002,
    network: "eip155:8453",
    reachable: true,
    is402: true,
    verdict: "ok",
  };
  assert.deepEqual(diffBaseline(a, a), []);
  assert.deepEqual(
    diffBaseline(a, { ...a, payTo: "0xdef" }),
    ["payTo"],
  );
  assert.deepEqual(
    diffBaseline(a, { ...a, priceUsd: 0.01 }),
    ["price"],
  );
  assert.deepEqual(
    diffBaseline(a, { ...a, network: "eip155:1" }),
    ["network"],
  );
  assert.deepEqual(
    diffBaseline(a, { ...a, reachable: false }),
    ["availability"],
  );
  assert.deepEqual(
    diffBaseline(a, { ...a, is402: false }),
    ["availability"],
  );
});

test("baselineFromCheck maps ToolCheck fields", () => {
  const b = baselineFromCheck({
    url: "https://example.com/x",
    verdict: "caution",
    checkedAt: "2026-11-01T00:00:00.000Z",
    live: true,
    cacheAgeMs: 0,
    status: 402,
    latencyMs: 10,
    is402: true,
    priceUsd: 0.005,
    payTo: "0x1",
    network: "eip155:8453",
    reasonCodes: [],
    history: { checks: 1, uptimePct: 100, payToChanges: [], priceChanges: [], recent: [] },
  });
  assert.equal(b.payTo, "0x1");
  assert.equal(b.priceUsd, 0.005);
  assert.equal(b.reachable, true);
  assert.equal(b.verdict, "caution");
});

test("watch price is $5 / 5000000 atomic", () => {
  assert.equal(WATCH_PRICE_USD, 5);
  assert.equal(WATCH_PRICE_ATOMIC, "5000000");
  const req = watchAcceptRequirement(
    "0xd98451514c7510e3fCd0463De973B9a6bB89A86f",
    "eip155:8453",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  );
  assert.equal(req.amount, "5000000");
  assert.equal(req.scheme, "exact");
  assert.equal(req.extra.priceUsd, 5);
  assert.equal(req.extra.pricingModel, "watch_30d");
  assert.equal(watchKey("abc"), "watch:sub:abc");
});


test("formatOnChainLine and loadOnChainStats", async () => {
  const kv = memoryKv();
  assert.equal(await loadOnChainStats(undefined), null);
  assert.equal(await loadOnChainStats(kv), null);
  const snap = {
    paidTransfers: 5,
    usdcTotal: 0.01,
    uniquePayers: 4,
    internalTestTransfers: 2,
    asOf: "2026-11-01T19:00:00.000Z",
    source: "base_usdc_transfers",
    network: "eip155:8453",
    payTo: "0xd98451514c7510e3fCd0463De973B9a6bB89A86f",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    transfers: [],
  };
  await kv.put(ONCHAIN_KEY, JSON.stringify(snap));
  const loaded = await loadOnChainStats(kv);
  assert.equal(loaded.paidTransfers, 5);
  const s = await loadStats(kv);
  assert.equal(s.onChain.paidTransfers, 5);
  assert.match(formatOnChainLine(snap), /5 paid on-chain/);
  assert.match(formatOnChainLine(snap), /\$0\.010 USDC/);
  assert.match(formatOnChainLine(snap), /4 wallets/);
});

test("formatBaselineLine is stable", () => {
  const line = formatBaselineLine({
    payTo: "0xabc",
    priceUsd: 0.002,
    network: "eip155:8453",
    reachable: true,
    is402: true,
    verdict: "ok",
  });
  assert.match(line, /payTo=0xabc/);
  assert.match(line, /price=\$0\.002/);
  assert.match(line, /availability=reachable\+402/);
  assert.match(line, /verdict=ok/);
});

test("sendWatchEmail no-ops without RESEND_API_KEY", async () => {
  const ok = await sendWatchEmail(
    { RESEND_API_KEY: "", PAYTO_HISTORY: memoryKv() },
    "buyer@example.com",
    {
      type: "x402check.watch.alert",
      watchId: "abc",
      url: "https://example.com/tool",
      changes: ["payTo"],
      baseline: {
        payTo: "0x1",
        priceUsd: 0.01,
        network: "eip155:8453",
        reachable: true,
        is402: true,
        verdict: "ok",
      },
      current: {
        payTo: "0x2",
        priceUsd: 0.01,
        network: "eip155:8453",
        reachable: true,
        is402: true,
        verdict: "caution",
      },
      checkedAt: "2026-11-01T12:00:00.000Z",
      expiresAt: "2026-12-01T12:00:00.000Z",
      docs: "https://x402check.dev/docs",
    },
  );
  assert.equal(ok, false);
});
