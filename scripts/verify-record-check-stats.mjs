#!/usr/bin/env node
/** In-memory KV mock: prove recordCheckStats increments global + hour buckets. */
import { createRequire } from "node:module";
// Use tsx to load TS
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";

const runner = `
import { recordCheckStats, loadStats } from "../src/stats.ts";

function mockKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    _store: store,
  };
}

const kv = mockKv();
await recordCheckStats(kv, { verdict: "ok", paid: true, isNewTool: true });
await recordCheckStats(kv, { verdict: "caution", paid: false });
await recordCheckStats(kv, { verdict: "avoid", paid: true });
const snap = await loadStats(kv);
const g = JSON.parse(await kv.get("stats:global"));
console.log(JSON.stringify({ snap, g }, null, 2));
if (g.totalChecks !== 3) throw new Error("totalChecks");
if (g.paidChecks !== 2) throw new Error("paidChecks");
if (g.toolsChecked !== 1) throw new Error("toolsChecked");
if (g.flaggedOk !== 1 || g.flaggedCaution !== 1 || g.flaggedAvoid !== 1) throw new Error("flags");
if (snap.last24hChecks !== 3) throw new Error("hour");
console.log("recordCheckStats OK");
`;
writeFileSync("/tmp/verify-rcs.mts", runner);
const r = spawnSync("npx", ["--yes", "tsx", "/tmp/verify-rcs.mts"], {
  cwd: "/workspace/x402-preflight",
  encoding: "utf8",
  env: process.env,
});
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status ?? 1);
