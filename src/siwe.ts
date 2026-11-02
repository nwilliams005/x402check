/**
 * EIP-191 personal_sign verify + ERC-1271 smart-wallet fallback.
 * Used for free-check wallet proof and owner payTo verification.
 */
import {
  createPublicClient,
  hashMessage,
  http,
  isAddress,
  recoverMessageAddress,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";

const ERC1271_MAGIC = "0x1626ba7e";
const ERC1271_ABI = [
  {
    name: "isValidSignature",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "hash", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "magicValue", type: "bytes4" }],
  },
] as const;

const BASE_RPC = "https://base-rpc.publicnode.com";

export function normalizeAddress(addr: string): string | null {
  if (!addr || typeof addr !== "string") return null;
  const t = addr.trim();
  if (!isAddress(t)) return null;
  return t.toLowerCase();
}

export function isHexSignature(sig: string): sig is Hex {
  return /^0x[0-9a-fA-F]+$/.test(sig) && sig.length >= 132;
}

/** Verify EIP-191 personal_sign; if recover fails or mismatches, try ERC-1271. */
export async function verifyWalletSignature(opts: {
  address: string;
  message: string;
  signature: string;
  rpcUrl?: string;
}): Promise<{ ok: true; method: "eoa" | "erc1271" } | { ok: false; error: string }> {
  const addr = normalizeAddress(opts.address);
  if (!addr) return { ok: false, error: "invalid_address" };
  if (!isHexSignature(opts.signature)) return { ok: false, error: "invalid_signature" };
  if (!opts.message || opts.message.length > 2048) {
    return { ok: false, error: "invalid_message" };
  }

  try {
    const recovered = await recoverMessageAddress({
      message: opts.message,
      signature: opts.signature as Hex,
    });
    if (recovered.toLowerCase() === addr) {
      return { ok: true, method: "eoa" };
    }
  } catch {
    /* fall through to ERC-1271 */
  }

  try {
    const client = createPublicClient({
      chain: base,
      transport: http(opts.rpcUrl || BASE_RPC, { timeout: 10_000 }),
    });
    const msgHash = hashMessage(opts.message);
    const magic = (await client.readContract({
      address: addr as Address,
      abi: ERC1271_ABI,
      functionName: "isValidSignature",
      args: [msgHash, opts.signature as Hex],
    })) as string;
    if (typeof magic === "string" && magic.toLowerCase() === ERC1271_MAGIC) {
      return { ok: true, method: "erc1271" };
    }
    return { ok: false, error: "signature_mismatch" };
  } catch {
    return { ok: false, error: "signature_mismatch" };
  }
}

/** Opaque random token (hex). */
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomNonce(): string {
  return randomToken(16);
}

/** Simple sliding-window rate limit stored in KV. */
export async function rateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const raw = await kv.get(key);
  let hits: number[] = [];
  if (raw) {
    try {
      hits = (JSON.parse(raw) as number[]).filter((t) => now - t < windowSec * 1000);
    } catch {
      hits = [];
    }
  }
  if (hits.length >= limit) {
    return { allowed: false, remaining: 0 };
  }
  hits.push(now);
  await kv.put(key, JSON.stringify(hits), { expirationTtl: windowSec + 60 });
  return { allowed: true, remaining: Math.max(0, limit - hits.length) };
}

/** Constant-ish delay to reduce timing oracles (best-effort). */
export async function padTiming(startedAt: number, minMs = 80): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < minMs) {
    await new Promise((r) => setTimeout(r, minMs - elapsed));
  }
}
