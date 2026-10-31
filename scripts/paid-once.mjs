#!/usr/bin/env node
/**
 * ONE real paid call to production x402check.dev.
 * Reads key from KEY_PATH (default /workspace/.x402test/key). Never prints the key.
 * Caps: MAX_ATTEMPTS paid settles (default 1). Abort if amount > 10000 atomic ($0.01).
 */
import { readFileSync } from "node:fs";
import { x402Client } from "@x402/core/client";
import { x402HTTPClient } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const KEY_PATH = process.env.KEY_PATH || "/workspace/.x402test/key";
const TARGET =
  process.env.PREFLIGHT_TARGET || "https://www.api-xpay.com/x402/ping";
const BASE = (process.env.X402CHECK_URL || "https://x402check.dev").replace(
  /\/$/,
  "",
);
const PREFLIGHT_URL =
  process.env.PREFLIGHT_URL ||
  `${BASE}/preflight?url=${encodeURIComponent(TARGET)}`;
const MAX_AMOUNT_ATOMIC = BigInt(process.env.MAX_AMOUNT_ATOMIC || "10000"); // $0.01
const MAX_PAID = Number(process.env.MAX_PAID_ATTEMPTS || "1");

function loadKey() {
  const raw = readFileSync(KEY_PATH, "utf8").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("KEY_PATH does not look like a 32-byte hex private key");
  }
  return raw;
}

async function usdcBalance(address) {
  const data =
    "0x70a08231" + address.slice(2).toLowerCase().padStart(64, "0");
  const res = await fetch("https://base-rpc.publicnode.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        {
          to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          data,
        },
        "latest",
      ],
    }),
  });
  const j = await res.json();
  if (!j.result) throw new Error(`balance rpc failed: ${JSON.stringify(j)}`);
  return BigInt(j.result);
}

async function checkBazaar(hostHint = "x402check.dev") {
  const u = new URL(
    "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources",
  );
  u.searchParams.set("limit", "100");
  // try resource filter if supported
  u.searchParams.set("resource", `https://${hostHint}/preflight`);
  try {
    const res = await fetch(u.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { http: res.status, listed: null, note: "non-json", sample: text.slice(0, 200) };
    }
    const items = data.items || data.resources || data.data || [];
    const listed = JSON.stringify(data).toLowerCase().includes(hostHint.toLowerCase());
    return {
      http: res.status,
      listed,
      itemCount: Array.isArray(items) ? items.length : null,
      matching: Array.isArray(items)
        ? items.filter((it) =>
            JSON.stringify(it).toLowerCase().includes(hostHint.toLowerCase()),
          ).length
        : null,
      note: listed ? "host found in discovery response" : "host not found in this page",
    };
  } catch (e) {
    return { listed: null, note: String(e) };
  }
}

async function main() {
  const key = loadKey();
  const account = privateKeyToAccount(key);
  console.log(JSON.stringify({ step: "wallet", address: account.address }));

  const balBefore = await usdcBalance(account.address);
  console.log(
    JSON.stringify({
      step: "balance_before",
      atomic: balBefore.toString(),
      usdc: Number(balBefore) / 1e6,
    }),
  );

  const core = new x402Client().register(
    "eip155:*",
    new ExactEvmScheme(account, {
      8453: { rpcUrl: "https://base-rpc.publicnode.com" },
    }),
  );
  const client = new x402HTTPClient(core);

  let paidAttempts = 0;

  // First request — expect 402
  const unpaid = await fetch(PREFLIGHT_URL, { headers: { accept: "application/json" } });
  const unpaidBodyText = await unpaid.text();
  let unpaidBody;
  try {
    unpaidBody = JSON.parse(unpaidBodyText);
  } catch {
    unpaidBody = unpaidBodyText;
  }
  console.log(
    JSON.stringify({
      step: "unpaid",
      status: unpaid.status,
      bodyPreview:
        typeof unpaidBody === "string"
          ? unpaidBody.slice(0, 120)
          : unpaidBody,
    }),
  );

  if (unpaid.status !== 402) {
    throw new Error(`Expected 402, got ${unpaid.status}`);
  }

  const paymentRequired = client.getPaymentRequiredResponse(
    (name) => unpaid.headers.get(name),
    unpaidBody,
  );

  const accepts = paymentRequired.accepts || [];
  const amount = BigInt(accepts[0]?.amount ?? "0");
  console.log(
    JSON.stringify({
      step: "requirements",
      network: accepts[0]?.network,
      payTo: accepts[0]?.payTo,
      amount: amount.toString(),
      amountUsd: Number(amount) / 1e6,
      asset: accepts[0]?.asset,
      resource: paymentRequired.resource?.url || paymentRequired.resource,
    }),
  );

  if (amount > MAX_AMOUNT_ATOMIC) {
    throw new Error(
      `Amount ${amount} exceeds MAX_AMOUNT_ATOMIC ${MAX_AMOUNT_ATOMIC}`,
    );
  }
  if (amount === 0n) throw new Error("No amount in payment requirements");

  if (paidAttempts >= MAX_PAID) throw new Error("MAX_PAID already reached");
  paidAttempts += 1;

  const paymentPayload = await client.createPaymentPayload(paymentRequired);
  const payHeaders = client.encodePaymentSignatureHeader(paymentPayload);

  const paid = await fetch(PREFLIGHT_URL, {
    headers: { accept: "application/json", ...payHeaders },
  });
  const paidText = await paid.text();
  let paidBody;
  try {
    paidBody = JSON.parse(paidText);
  } catch {
    paidBody = paidText;
  }

  let settlement;
  try {
    settlement = client.getPaymentSettleResponse((name) =>
      paid.headers.get(name),
    );
  } catch (e) {
    settlement = { error: String(e) };
  }

  // Also dump relevant response headers (no secrets)
  const headerDump = {};
  for (const h of [
    "payment-response",
    "PAYMENT-RESPONSE",
    "x-payment-response",
    "X-PAYMENT-RESPONSE",
    "extension-responses",
    "EXTENSION-RESPONSES",
  ]) {
    const v = paid.headers.get(h);
    if (v) headerDump[h] = v.slice(0, 500);
  }

  const balAfter = await usdcBalance(account.address);

  const bazaar = await checkBazaar("x402check.dev");

  const out = {
    step: "result",
    success: paid.status === 200,
    httpStatus: paid.status,
    verdict: paidBody?.verdict ?? null,
    bodySummary:
      typeof paidBody === "object" && paidBody
        ? {
            url: paidBody.url,
            verdict: paidBody.verdict,
            live: paidBody.live,
            priceUsd: paidBody.priceUsd,
            payTo: paidBody.payTo,
            reasonCodes: paidBody.reasonCodes,
            history: paidBody.history,
          }
        : paidBody,
    settlement,
    headerDump,
    balanceAfter: {
      atomic: balAfter.toString(),
      usdc: Number(balAfter) / 1e6,
      spentAtomic: (balBefore - balAfter).toString(),
    },
    bazaar,
    paidAttempts,
  };
  console.log(JSON.stringify(out, null, 2));

  if (paid.status !== 200) process.exit(2);
}

main().catch((e) => {
  console.error(JSON.stringify({ step: "fatal", error: String(e), stack: e.stack }));
  process.exit(1);
});
