import { readFileSync } from "node:fs";
import { sendWatchEmail, type WatchAlertPayload } from "../src/watch.ts";
import type { Env } from "../src/types.ts";

const TO = process.env.WATCH_TEST_TO || "nicklauswilliams25@gmail.com";
const apiKey = readFileSync(process.env.RESEND_KEY_FILE || "/workspace/.resend-key", "utf8").trim();

const payload: WatchAlertPayload = {
  type: "x402check.watch.alert",
  watchId: "test-watch-email-001",
  url: "https://example.com/x402-test",
  changes: ["price"],
  checkedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30 * 864e5).toISOString(),
  baseline: {
    payTo: "0x0000000000000000000000000000000000000001",
    priceUsd: 0.01,
    network: "eip155:8453",
    reachable: true,
    is402: true,
    verdict: "ok",
  },
  current: {
    payTo: "0x0000000000000000000000000000000000000001",
    priceUsd: 0.02,
    network: "eip155:8453",
    reachable: true,
    is402: true,
    verdict: "caution",
  },
  docs: "https://x402check.dev/docs",
};

const env = {
  RESEND_API_KEY: apiKey,
  RESEND_FROM: "x402check Watch <watch@alerts.x402check.dev>",
} as Env;

const ok = await sendWatchEmail(env, TO, payload);
console.log(JSON.stringify({ ok, to: TO, via: "src/watch.ts#sendWatchEmail" }));
if (!ok) {
  // Extra diagnostic without changing sendWatchEmail
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "x402check Watch <watch@alerts.x402check.dev>",
      to: [TO],
      subject: "diag",
      text: "diag",
    }),
  });
  console.error("diag", r.status, await r.text());
  process.exit(1);
}
