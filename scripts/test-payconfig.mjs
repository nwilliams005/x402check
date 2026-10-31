#!/usr/bin/env node
/**
 * Unit checks for Solana payTo validation (mirrors src/payconfig.ts).
 */
import assert from "node:assert/strict";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const DEFAULT_PAY_TO_SOLANA = "AAAU23APUxKMRT1fbig22q4JzxXgx81vPynan2LmPcuT";
const USDC_SOLANA_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

function decodeBase58(s) {
  if (!s || typeof s !== "string") return null;
  let num = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) return null;
    num = num * 58n + BigInt(i);
  }
  const bytes = [];
  while (num > 0n) {
    bytes.unshift(Number(num % 256n));
    num = num / 256n;
  }
  for (const c of s) {
    if (c === "1") bytes.unshift(0);
    else break;
  }
  return new Uint8Array(bytes);
}

function isValidSolanaPubkey(s) {
  const bytes = decodeBase58(s);
  return bytes !== null && bytes.length === 32;
}

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ test: name, ok: true });
  } catch (e) {
    results.push({ test: name, ok: false, error: String(e?.message || e) });
  }
}

check("Nicklaus Solana address is valid 32-byte pubkey", () => {
  assert.equal(isValidSolanaPubkey(DEFAULT_PAY_TO_SOLANA), true);
});

check("rejects short / invalid / EVM address", () => {
  assert.equal(isValidSolanaPubkey("not-a-key"), false);
  assert.equal(isValidSolanaPubkey("AAA"), false);
  assert.equal(
    isValidSolanaPubkey("0xd98451514c7510e3fCd0463De973B9a6bB89A86f"),
    false,
  );
});

check("official USDC mint is valid pubkey", () => {
  assert.equal(isValidSolanaPubkey(USDC_SOLANA_MAINNET), true);
});

check("user-typo mint is also 32 bytes but not Circle USDC", () => {
  const typo = "EPjFWJd5AwFUZLRaHAwfWzr7zz8v6Ar2fz4mbE38Ep8B";
  assert.equal(isValidSolanaPubkey(typo), true);
  assert.notEqual(typo, USDC_SOLANA_MAINNET);
});

check("CAIP-2 Solana mainnet id is expected shape", () => {
  assert.match(SOLANA_MAINNET, /^solana:[1-9A-HJ-NP-Za-km-z]+$/);
});

check("ENABLE_SOLANA defaults off without flag", () => {
  function isSolanaEnabled(env) {
    const v = (env.ENABLE_SOLANA || "").trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes";
  }
  assert.equal(isSolanaEnabled({}), false);
  assert.equal(isSolanaEnabled({ ENABLE_SOLANA: "false", PAY_TO_SOLANA: DEFAULT_PAY_TO_SOLANA }), false);
  assert.equal(isSolanaEnabled({ ENABLE_SOLANA: "true" }), true);
  assert.equal(isSolanaEnabled({ ENABLE_SOLANA: "1" }), true);
});


console.log(JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`${failed.length} payconfig test(s) failed`);
  process.exit(1);
}
console.log(`payconfig: ${results.length} passed`);
