#!/usr/bin/env node
/**
 * Unit tests for free-check / scan grade / badge / siwe helpers.
 * No wrangler, no deploy. Uses local viem wallet for EIP-191.
 */
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import {
  normalizeAddress,
  isHexSignature,
  verifyWalletSignature,
  randomToken,
  randomNonce,
} from "../src/siwe.ts";
import {
  buildFreeMessage,
  FREE_CHALLENGE_TTL_SEC,
} from "../src/free-check.ts";
import {
  gradeEndpoint,
  normalizeScanUrl,
  hashUrl,
  publicScanAggregatesForbidden,
} from "../src/scan.ts";
import { badgeSvg, badgeEmbedSnippet } from "../src/badge.ts";
import { buildOwnerMessage } from "../src/owner.ts";

const pk =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const account = privateKeyToAccount(pk);

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`ok — ${name}`);
}

// --- siwe ---
assert.equal(normalizeAddress("0xABCDEF"), null); // too short
assert.equal(
  normalizeAddress(account.address),
  account.address.toLowerCase(),
);
ok("normalizeAddress");

assert.equal(isHexSignature("nope"), false);
assert.equal(isHexSignature("0x" + "ab".repeat(65)), true);
ok("isHexSignature");

{
  const message = "x402check unit test " + randomNonce();
  const signature = await account.signMessage({ message });
  const good = await verifyWalletSignature({
    address: account.address,
    message,
    signature,
  });
  assert.equal(good.ok, true);
  assert.equal(good.method, "eoa");

  const bad = await verifyWalletSignature({
    address: account.address,
    message: message + "x",
    signature,
  });
  assert.equal(bad.ok, false);
  ok("verifyWalletSignature eoa");
}

assert.match(randomToken(24), /^[0-9a-f]{48}$/);
assert.match(randomNonce(), /^[0-9a-f]{32}$/);
ok("randomToken/nonce");

// --- free message ---
{
  const msg = buildFreeMessage({
    origin: "https://x402check.dev",
    address: account.address.toLowerCase(),
    nonce: "abc",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  assert.match(msg, /x402check free-check v1/);
  assert.match(msg, /\/preflight\/free/);
  assert.ok(FREE_CHALLENGE_TTL_SEC >= 60);
  ok("buildFreeMessage");
}

// --- scan grade ---
{
  const pass = gradeEndpoint({
    live: true,
    is402: true,
    status: 402,
    livePriceUsd: 0.01,
    livePayTo: "0x1111111111111111111111111111111111111111",
    listedPriceUsd: 0.01,
    listedPayTo: "0x1111111111111111111111111111111111111111",
  });
  assert.equal(pass.grade, "pass");

  const failPay = gradeEndpoint({
    live: true,
    is402: true,
    status: 402,
    livePriceUsd: 0.01,
    livePayTo: "0x1111111111111111111111111111111111111111",
    listedPriceUsd: 0.01,
    listedPayTo: "0x2222222222222222222222222222222222222222",
  });
  assert.equal(failPay.grade, "fail");
  assert.ok(failPay.reasons.includes("payto_mismatch"));

  const failDown = gradeEndpoint({
    live: false,
    is402: false,
    status: null,
    livePriceUsd: null,
    livePayTo: null,
    listedPriceUsd: null,
    listedPayTo: null,
  });
  assert.equal(failDown.grade, "fail");

  const warnPrice = gradeEndpoint({
    live: true,
    is402: true,
    status: 402,
    livePriceUsd: 0.12,
    livePayTo: "0x1111111111111111111111111111111111111111",
    listedPriceUsd: 0.1,
    listedPayTo: "0x1111111111111111111111111111111111111111",
  });
  assert.equal(warnPrice.grade, "warn");
  ok("gradeEndpoint pass/warn/fail");
}

{
  const a = normalizeScanUrl("https://Example.com/x402/");
  const b = normalizeScanUrl("https://example.com/x402");
  assert.equal(a, b);
  const h1 = await hashUrl(a);
  const h2 = await hashUrl(b);
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
  ok("normalizeScanUrl + hashUrl");
}

assert.throws(() => publicScanAggregatesForbidden(), /not public/);
ok("publicScanAggregatesForbidden");

// --- badge ---
{
  const svg = badgeSvg({
    gradeLabel: "pass",
    dateLabel: "2026-11-02",
    origin: "https://x402check.dev",
  });
  assert.match(svg, /Verified by x402check/);
  assert.match(svg, /2026-11-02/);
  assert.doesNotMatch(svg, /https:\/\/example\.com/); // no endpoint URL leakage
  const snip = badgeEmbedSnippet("https://x402check.dev", "aabbcc");
  assert.match(snip, /\/badge\/aabbcc\.svg/);
  assert.match(snip, /\/scan/);
  ok("badgeSvg + embed snippet");
}

// --- owner message ---
{
  const msg = buildOwnerMessage({
    origin: "https://x402check.dev",
    url: "https://seller.example/x402",
    payTo: account.address.toLowerCase(),
    nonce: "deadbeef",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  assert.match(msg, /x402check owner-verify/);
  assert.match(msg, /seller\.example/);
  ok("buildOwnerMessage");
}

console.log(`\nAll ${passed} unit groups passed`);
