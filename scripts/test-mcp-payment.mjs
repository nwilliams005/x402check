#!/usr/bin/env node
/**
 * Unit tests for MCP transport x402 payment (transports-v2/mcp.md).
 * Run: npx tsx scripts/test-mcp-payment.mjs
 * Mocks verify/settle — never hits CDP or chain.
 */
import assert from "node:assert/strict";
import {
  MCP_PAYMENT_META_KEY,
  MCP_PAYMENT_RESPONSE_META_KEY,
  PAID_TOOLS,
  billableToolCount,
  buildStaticAccepts,
  buildStaticPaymentRequired,
  extractPaymentFromMeta,
  gatePaidToolCall,
  paymentRequiredResult,
  successToolResult,
  toolResourceInfo,
} from "../src/mcp-payment.ts";
import { resolvePayConfig, DEFAULT_PAY_TO_EVM, USDC_BASE_MAINNET } from "../src/payconfig.ts";

const results = [];
function check(name, fn) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      results.push({ test: name, ok: true });
    })
    .catch((e) => {
      results.push({
        test: name,
        ok: false,
        error: String(e?.message || e),
      });
    });
}

const UNIT = 0.002;
const cfg = resolvePayConfig({}); // Base-only, default payTo

function mockAccepts(toolCount = 1) {
  return buildStaticAccepts(cfg, UNIT, toolCount);
}

function mockGate(overrides = {}) {
  const accepts = mockAccepts(1);
  return {
    buildAccepts: async (n) => buildStaticAccepts(cfg, UNIT, n),
    createPaymentRequired: async (acc, resource, error, paymentPayload) => ({
      x402Version: 2,
      error,
      resource,
      accepts: acc,
      ...(paymentPayload ? { payment: paymentPayload } : {}),
    }),
    findMatching: (acc, payload) => {
      const accepted = payload?.accepted;
      if (!accepted) return acc[0];
      return (
        acc.find(
          (r) =>
            r.scheme === accepted.scheme &&
            r.network === accepted.network &&
            r.amount === accepted.amount,
        ) || undefined
      );
    },
    verify: async () => ({ isValid: true }),
    settle: async () => ({
      success: true,
      transaction:
        "0xabc0000000000000000000000000000000000000000000000000000000000001",
      network: "eip155:8453",
      payer: "0x857b06519E91e3A54538791bDbb0E22373e36b66",
    }),
    ...overrides,
  };
}

function samplePayload(accepted) {
  return {
    x402Version: 2,
    resource: toolResourceInfo("preflight_check"),
    accepted: accepted || mockAccepts(1)[0],
    payload: {
      signature: "0xdead",
      authorization: {
        from: "0x857b06519E91e3A54538791bDbb0E22373e36b66",
        to: DEFAULT_PAY_TO_EVM,
        value: "2000",
        validAfter: "1",
        validBefore: "9999999999",
        nonce: "0x1",
      },
    },
  };
}

await check("PAID_TOOLS covers four paid tools", () => {
  assert.deepEqual(
    [...PAID_TOOLS].sort(),
    ["compare_tools", "preflight_batch", "preflight_check", "verify_payto"].sort(),
  );
});

await check("billableToolCount single + batch dedupe/cap", () => {
  assert.equal(billableToolCount("preflight_check", { url: " https://a " }), 1);
  assert.equal(billableToolCount("verify_payto", { url: "" }), 0);
  assert.equal(
    billableToolCount("compare_tools", {
      urls: ["https://a", "https://a", "https://b"],
    }),
    2,
  );
  const many = Array.from({ length: 40 }, (_, i) => `https://x/${i}`);
  assert.equal(billableToolCount("preflight_batch", { urls: many }), 25);
});

await check("toolResourceInfo uses mcp://tool/{name}", () => {
  const r = toolResourceInfo("preflight_check", "desc");
  assert.equal(r.url, "mcp://tool/preflight_check");
  assert.equal(r.mimeType, "application/json");
  assert.equal(r.description, "desc");
});

await check("static accepts match HTTP Base Exact shape + scaled amount", () => {
  const one = buildStaticAccepts(cfg, UNIT, 1)[0];
  assert.equal(one.scheme, "exact");
  assert.equal(one.network, "eip155:8453");
  assert.equal(one.payTo, DEFAULT_PAY_TO_EVM);
  assert.equal(one.asset, USDC_BASE_MAINNET);
  assert.equal(one.amount, "2000");
  const three = buildStaticAccepts(cfg, UNIT, 3)[0];
  assert.equal(three.amount, "6000");
  assert.equal(three.extra.chargedTools, 3);
  assert.equal(three.extra.pricePerToolUsd, UNIT);
});

await check("extractPaymentFromMeta reads x402/payment", () => {
  assert.equal(extractPaymentFromMeta(undefined), null);
  assert.equal(extractPaymentFromMeta({}), null);
  const p = samplePayload();
  const got = extractPaymentFromMeta({ [MCP_PAYMENT_META_KEY]: p });
  assert.equal(got.x402Version, 2);
  assert.ok(got.payload);
});

await check("paymentRequiredResult isError + dual content", () => {
  const pr = buildStaticPaymentRequired(
    "preflight_check",
    cfg,
    UNIT,
    1,
    "Payment required to access this tool",
  );
  const res = paymentRequiredResult(pr);
  assert.equal(res.isError, true);
  assert.equal(res.structuredContent.x402Version, 2);
  assert.ok(Array.isArray(res.structuredContent.accepts));
  assert.equal(res.content[0].type, "text");
  assert.deepEqual(JSON.parse(res.content[0].text), res.structuredContent);
  assert.equal(res.structuredContent.resource.url, "mcp://tool/preflight_check");
});

await check("unpaid tools/call → PaymentRequired with accepts", async () => {
  const res = await gatePaidToolCall({
    toolName: "preflight_check",
    args: { url: "https://seller.example/x402" },
    meta: undefined,
    description: "x402check preflight_check",
    unitUsd: UNIT,
    toolCount: 1,
    gate: mockGate(),
    run: async () => {
      throw new Error("should not run unpaid");
    },
  });
  assert.equal(res.isError, true);
  assert.equal(res.structuredContent.x402Version, 2);
  assert.ok(res.structuredContent.accepts.length >= 1);
  assert.equal(res.structuredContent.accepts[0].payTo, DEFAULT_PAY_TO_EVM);
  assert.equal(res.structuredContent.accepts[0].amount, "2000");
  assert.equal(
    res.structuredContent.resource.url,
    "mcp://tool/preflight_check",
  );
  assert.equal(
    JSON.parse(res.content[0].text).error,
    "Payment required to access this tool",
  );
});

await check("paid valid payload → verify+settle → payment-response meta", async () => {
  let ran = false;
  const payload = samplePayload();
  const res = await gatePaidToolCall({
    toolName: "preflight_check",
    args: { url: "https://seller.example/x402" },
    meta: { [MCP_PAYMENT_META_KEY]: payload },
    unitUsd: UNIT,
    toolCount: 1,
    gate: mockGate(),
    run: async () => {
      ran = true;
      return { url: "https://seller.example/x402", verdict: "ok" };
    },
  });
  assert.equal(ran, true);
  assert.notEqual(res.isError, true);
  assert.equal(res.structuredContent.verdict, "ok");
  const settle = res._meta[MCP_PAYMENT_RESPONSE_META_KEY];
  assert.equal(settle.success, true);
  assert.equal(settle.network, "eip155:8453");
  assert.ok(settle.transaction.startsWith("0x"));
});

await check("invalid verify → PaymentRequired with reason (no tool run)", async () => {
  let ran = false;
  const res = await gatePaidToolCall({
    toolName: "verify_payto",
    args: { url: "https://seller.example/x402" },
    meta: { [MCP_PAYMENT_META_KEY]: samplePayload() },
    unitUsd: UNIT,
    toolCount: 1,
    gate: mockGate({
      verify: async () => ({
        isValid: false,
        invalidReason: "invalid_signature",
      }),
    }),
    run: async () => {
      ran = true;
      return {};
    },
  });
  assert.equal(ran, false);
  assert.equal(res.isError, true);
  assert.equal(res.structuredContent.error, "invalid_signature");
  assert.ok(res.structuredContent.accepts.length >= 1);
});

await check("no matching requirements → PaymentRequired", async () => {
  const res = await gatePaidToolCall({
    toolName: "preflight_check",
    args: { url: "https://seller.example/x402" },
    meta: {
      [MCP_PAYMENT_META_KEY]: samplePayload({
        scheme: "exact",
        network: "eip155:999",
        amount: "1",
        asset: USDC_BASE_MAINNET,
        payTo: DEFAULT_PAY_TO_EVM,
        maxTimeoutSeconds: 60,
      }),
    },
    unitUsd: UNIT,
    toolCount: 1,
    gate: mockGate({
      findMatching: () => undefined,
    }),
    run: async () => ({}),
  });
  assert.equal(res.isError, true);
  assert.match(res.structuredContent.error, /No matching/i);
});

await check("settle failure after run → PaymentRequired without tool content", async () => {
  const res = await gatePaidToolCall({
    toolName: "compare_tools",
    args: { urls: ["https://a", "https://b"] },
    meta: { [MCP_PAYMENT_META_KEY]: samplePayload(mockAccepts(2)[0]) },
    unitUsd: UNIT,
    toolCount: 2,
    gate: mockGate({
      settle: async () => ({
        success: false,
        errorReason: "settlement_failed",
        transaction: "",
        network: "eip155:8453",
      }),
    }),
    run: async () => ({ results: [{ verdict: "ok" }, { verdict: "ok" }] }),
  });
  assert.equal(res.isError, true);
  assert.equal(res.structuredContent.error, "settlement_failed");
  assert.equal(res.structuredContent.results, undefined);
  assert.ok(res.structuredContent.accepts[0].amount === "4000");
});

await check("batch accepts amount scales with toolCount", async () => {
  const res = await gatePaidToolCall({
    toolName: "preflight_batch",
    args: { urls: ["https://a", "https://b", "https://c"] },
    meta: undefined,
    unitUsd: UNIT,
    toolCount: 3,
    gate: mockGate(),
    run: async () => ({}),
  });
  assert.equal(res.structuredContent.accepts[0].amount, "6000");
  assert.equal(res.structuredContent.accepts[0].extra.chargedTools, 3);
});

await check("successToolResult puts SettleResponse under x402/payment-response", () => {
  const settle = {
    success: true,
    transaction: "0x1",
    network: "eip155:8453",
    payer: "0xabc",
  };
  const res = successToolResult({ verdict: "ok" }, settle);
  assert.deepEqual(res._meta[MCP_PAYMENT_RESPONSE_META_KEY], settle);
  assert.equal(res.structuredContent.verdict, "ok");
});

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.test}${r.error ? " — " + r.error : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
