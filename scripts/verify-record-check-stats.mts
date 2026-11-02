import { recordCheckStats, loadStats } from "../src/stats.ts";

function mockKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    _store: store,
  };
}

const kv = mockKv() as any;
await recordCheckStats(kv, { verdict: "ok", paid: true, isNewTool: true });
await recordCheckStats(kv, { verdict: "caution", paid: false });
await recordCheckStats(kv, { verdict: "avoid", paid: true });
const snap = await loadStats(kv);
const g = JSON.parse(await kv.get("stats:global"));
console.log(JSON.stringify({ totalChecks: g.totalChecks, paidChecks: g.paidChecks, toolsChecked: g.toolsChecked, flaggedOk: g.flaggedOk, flaggedCaution: g.flaggedCaution, flaggedAvoid: g.flaggedAvoid, last24hChecks: snap.last24hChecks }, null, 2));
if (g.totalChecks !== 3) throw new Error("totalChecks");
if (g.paidChecks !== 2) throw new Error("paidChecks");
if (g.toolsChecked !== 1) throw new Error("toolsChecked");
if (g.flaggedOk !== 1 || g.flaggedCaution !== 1 || g.flaggedAvoid !== 1) throw new Error("flags");
if (snap.last24hChecks !== 3) throw new Error("hour");
console.log("recordCheckStats OK");
