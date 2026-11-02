/**
 * One free regular check ever per agent wallet.
 * Identity: EIP-191 / ERC-1271 signature over a short-lived nonce challenge.
 * Persist lifetime claim in KV. Deep/batch never free.
 */
import type { Env, ToolCheck } from "./types";
import { checkTool, isBlockedHost } from "./preflight";
import {
  normalizeAddress,
  padTiming,
  randomNonce,
  rateLimit,
  verifyWalletSignature,
} from "./siwe";
import { deepUpsellHint, watchUpsellHint } from "./deep";

export const FREE_CLAIM_PREFIX = "free:v1:";
export const FREE_CHALLENGE_PREFIX = "free:chal:";
export const FREE_CHALLENGE_TTL_SEC = 300; // 5 min
export const FREE_IP_CHAL_LIMIT = 10;
export const FREE_ADDR_CHAL_LIMIT = 5;
export const FREE_IP_CLAIM_LIMIT = 20; // claim attempts / hour / IP
export const FREE_RATE_WINDOW_SEC = 3600;

export type FreeChallenge = {
  address: string;
  nonce: string;
  expiresAt: string;
  message: string;
};

export type FreeClaimRecord = {
  address: string;
  usedAt: string;
  url: string;
  method: "eoa" | "erc1271";
};

function claimKey(addr: string): string {
  return `${FREE_CLAIM_PREFIX}${addr}`;
}

function challengeKey(addr: string, nonce: string): string {
  return `${FREE_CHALLENGE_PREFIX}${addr}:${nonce}`;
}

export function buildFreeMessage(opts: {
  origin: string;
  address: string;
  nonce: string;
  expiresAt: string;
}): string {
  return [
    "x402check free-check v1",
    `URI: ${opts.origin}/preflight/free`,
    `Address: ${opts.address}`,
    `Nonce: ${opts.nonce}`,
    `Expires: ${opts.expiresAt}`,
  ].join("\n");
}

export async function hasUsedFreeCheck(
  kv: KVNamespace,
  address: string,
): Promise<boolean> {
  const addr = normalizeAddress(address);
  if (!addr) return true;
  return (await kv.get(claimKey(addr))) != null;
}

export async function issueFreeChallenge(
  env: Env,
  opts: { address: string; origin: string; clientIp: string },
): Promise<
  | { ok: true; challenge: FreeChallenge }
  | { ok: false; error: string; status: number }
> {
  const addr = normalizeAddress(opts.address);
  if (!addr) return { ok: false, error: "invalid_address", status: 400 };

  const ipRl = await rateLimit(
    env.PAYTO_HISTORY,
    `rl:free:chal:ip:${opts.clientIp || "unknown"}`,
    FREE_IP_CHAL_LIMIT,
    FREE_RATE_WINDOW_SEC,
  );
  if (!ipRl.allowed) {
    return { ok: false, error: "rate_limited", status: 429 };
  }
  const addrRl = await rateLimit(
    env.PAYTO_HISTORY,
    `rl:free:chal:addr:${addr}`,
    FREE_ADDR_CHAL_LIMIT,
    FREE_RATE_WINDOW_SEC,
  );
  if (!addrRl.allowed) {
    return { ok: false, error: "rate_limited", status: 429 };
  }

  if (await hasUsedFreeCheck(env.PAYTO_HISTORY, addr)) {
    return { ok: false, error: "already_used", status: 409 };
  }

  const nonce = randomNonce();
  const expiresAt = new Date(Date.now() + FREE_CHALLENGE_TTL_SEC * 1000).toISOString();
  const message = buildFreeMessage({
    origin: opts.origin,
    address: addr,
    nonce,
    expiresAt,
  });
  await env.PAYTO_HISTORY.put(
    challengeKey(addr, nonce),
    JSON.stringify({ address: addr, nonce, expiresAt }),
    { expirationTtl: FREE_CHALLENGE_TTL_SEC },
  );
  return {
    ok: true,
    challenge: { address: addr, nonce, expiresAt, message },
  };
}

export async function redeemFreeCheck(
  env: Env,
  opts: {
    origin: string;
    clientIp: string;
    address: string;
    nonce: string;
    signature: string;
    url: string;
  },
): Promise<
  | {
      ok: true;
      result: ToolCheck & {
        free: true;
        freeRemaining: 0;
        watchHint: string;
        deepHint: string;
      };
    }
  | { ok: false; error: string; status: number; message?: string }
> {
  const t0 = Date.now();
  const addr = normalizeAddress(opts.address);
  if (!addr) {
    await padTiming(t0);
    return { ok: false, error: "invalid_address", status: 400 };
  }

  const ipRl = await rateLimit(
    env.PAYTO_HISTORY,
    `rl:free:claim:ip:${opts.clientIp || "unknown"}`,
    FREE_IP_CLAIM_LIMIT,
    FREE_RATE_WINDOW_SEC,
  );
  if (!ipRl.allowed) {
    await padTiming(t0);
    return { ok: false, error: "rate_limited", status: 429 };
  }

  if (!opts.nonce || !/^[0-9a-f]{16,64}$/i.test(opts.nonce)) {
    await padTiming(t0);
    return { ok: false, error: "invalid_nonce", status: 400 };
  }

  const url = (opts.url || "").trim();
  if (!url) {
    await padTiming(t0);
    return { ok: false, error: "missing_url", status: 400 };
  }
  if (isBlockedHost(url)) {
    await padTiming(t0);
    return {
      ok: false,
      error: "blocked_host",
      status: 400,
      message: "Refusing private/localhost/metadata hosts.",
    };
  }

  // Lifetime gate first (cheap)
  if (await hasUsedFreeCheck(env.PAYTO_HISTORY, addr)) {
    await padTiming(t0);
    return {
      ok: false,
      error: "already_used",
      status: 409,
      message:
        "This wallet already used its one free regular check. Pay $0.01 Exact USDC for further checks.",
    };
  }

  const chalRaw = await env.PAYTO_HISTORY.get(challengeKey(addr, opts.nonce));
  if (!chalRaw) {
    await padTiming(t0);
    return {
      ok: false,
      error: "invalid_or_expired_challenge",
      status: 400,
      message: "Request a fresh challenge from GET /preflight/free/challenge.",
    };
  }
  let chal: { address: string; nonce: string; expiresAt: string };
  try {
    chal = JSON.parse(chalRaw) as typeof chal;
  } catch {
    await padTiming(t0);
    return { ok: false, error: "invalid_or_expired_challenge", status: 400 };
  }
  if (Date.parse(chal.expiresAt) < Date.now()) {
    await padTiming(t0);
    return { ok: false, error: "invalid_or_expired_challenge", status: 400 };
  }

  const message = buildFreeMessage({
    origin: opts.origin,
    address: addr,
    nonce: opts.nonce,
    expiresAt: chal.expiresAt,
  });
  const verified = await verifyWalletSignature({
    address: addr,
    message,
    signature: opts.signature,
  });
  if (!verified.ok) {
    await padTiming(t0);
    return { ok: false, error: verified.error, status: 401 };
  }

  // Re-check + claim (best-effort atomicity under KV)
  if (await hasUsedFreeCheck(env.PAYTO_HISTORY, addr)) {
    await padTiming(t0);
    return { ok: false, error: "already_used", status: 409 };
  }

  const usedAt = new Date().toISOString();
  const claim: FreeClaimRecord = {
    address: addr,
    usedAt,
    url,
    method: verified.method,
  };
  // Write claim BEFORE running the probe so a crash mid-probe still burns the free check
  // (prevents replay). Probe failures still consume the free check · documented.
  await env.PAYTO_HISTORY.put(claimKey(addr), JSON.stringify(claim));
  // Invalidate challenge
  await env.PAYTO_HISTORY.put(challengeKey(addr, opts.nonce), "", {
    expirationTtl: 60,
  });

  const result = await checkTool(url, env, { forceLive: true });
  await padTiming(t0, 50);
  return {
    ok: true,
    result: {
      ...result,
      free: true,
      freeRemaining: 0,
      watchHint: watchUpsellHint(),
      deepHint: deepUpsellHint(opts.origin),
    },
  };
}
