/**
 * Payment networks + payTo config for x402 Exact.
 * Production: Base mainnet + Solana mainnet via CDP facilitator.
 * feePayer for SVM is injected by ExactSvmScheme from facilitator /supported.
 *
 * payTo on Solana is the OWNER pubkey. Clients TransferChecked to the USDC ATA
 * derived from (owner, mint). That ATA must already exist — @x402/svm does not
 * create it. Official Circle USDC mint on Solana mainnet:
 * EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
 */
/** Structural match for @x402/core PaymentOption (avoid brittle type re-exports). */
export type PriceFn = (ctx: any) => string | Promise<string> | number | Promise<number> | { amount: string; asset: string } | Promise<{ amount: string; asset: string }>;
export type AcceptOption = {
  scheme: string;
  payTo: string;
  price: PriceFn | string | number;
  network: `${string}:${string}`;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
};

export const BASE_MAINNET = "eip155:8453" as const;
export const BASE_SEPOLIA = "eip155:84532" as const;
export const SOLANA_MAINNET =
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" as const;
export const SOLANA_DEVNET =
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" as const;

/** Circle USDC on Solana mainnet (official; used by @x402/svm defaults). */
export const USDC_SOLANA_MAINNET =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
/** Circle USDC on Base mainnet. */
export const USDC_BASE_MAINNET =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export const DEFAULT_PAY_TO_EVM =
  "0xd98451514c7510e3fCd0463De973B9a6bB89A86f" as `0x${string}`;
/** Nicklaus Coinbase Solana USDC receive address (owner pubkey). */
export const DEFAULT_PAY_TO_SOLANA =
  "AAAU23APUxKMRT1fbig22q4JzxXgx81vPynan2LmPcuT";

const B58 =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Decode base58 → bytes. Returns null on invalid alphabet. */
export function decodeBase58(s: string): Uint8Array | null {
  if (!s || typeof s !== "string") return null;
  let num = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) return null;
    num = num * 58n + BigInt(i);
  }
  const bytes: number[] = [];
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

/** True when `s` is a base58-encoded 32-byte Ed25519 pubkey. */
export function isValidSolanaPubkey(s: string): boolean {
  const bytes = decodeBase58(s);
  return bytes !== null && bytes.length === 32;
}

export function assertSolanaPayTo(addr: string): string {
  if (!isValidSolanaPubkey(addr)) {
    throw new Error(
      `Invalid Solana payTo (need base58 32-byte pubkey): ${addr.slice(0, 12)}…`,
    );
  }
  return addr;
}

export type PayEnv = {
  PAY_TO?: string;
  NETWORK?: string;
  PAY_TO_SOLANA?: string;
  SOLANA_NETWORK?: string;
};

export type ResolvedPayConfig = {
  evmPayTo: `0x${string}`;
  evmNetwork: `${string}:${string}`;
  solanaPayTo: string | null;
  solanaNetwork: `${string}:${string}` | null;
};

/**
 * Resolve payTo/network pairs. Solana is optional — omitted when PAY_TO_SOLANA
 * is empty/unset. When set, address must be a valid Solana pubkey.
 */
export function resolvePayConfig(env: PayEnv): ResolvedPayConfig {
  const evmPayTo = (env.PAY_TO || DEFAULT_PAY_TO_EVM) as `0x${string}`;
  const evmNetwork = (env.NETWORK || BASE_MAINNET) as `${string}:${string}`;

  const rawSol = (env.PAY_TO_SOLANA || "").trim();
  if (!rawSol) {
    return {
      evmPayTo,
      evmNetwork,
      solanaPayTo: null,
      solanaNetwork: null,
    };
  }
  const solanaPayTo = assertSolanaPayTo(rawSol);
  const solanaNetwork = (env.SOLANA_NETWORK || SOLANA_MAINNET) as `${string}:${string}`;
  return { evmPayTo, evmNetwork, solanaPayTo, solanaNetwork };
}

/** Build the accepts[] list for paymentMiddleware routes. */
export function buildAccepts(
  cfg: ResolvedPayConfig,
  priceFn: PriceFn,
  unitUsd: number,
): AcceptOption[] {
  const commonExtra = {
    pricePerToolUsd: unitUsd,
    pricingModel: "per_tool",
    batchNote:
      "POST body urls[] → DynamicPrice = N×unit in ONE Exact settlement (not N separate txs).",
  };

  const accepts: AcceptOption[] = [
    {
      scheme: "exact",
      price: priceFn,
      network: cfg.evmNetwork,
      payTo: cfg.evmPayTo,
      maxTimeoutSeconds: 60,
      extra: {
        ...commonExtra,
        assetHint: "USDC",
        chainFamily: "evm",
      },
    },
  ];

  if (cfg.solanaPayTo && cfg.solanaNetwork) {
    accepts.push({
      scheme: "exact",
      price: priceFn,
      network: cfg.solanaNetwork,
      payTo: cfg.solanaPayTo,
      maxTimeoutSeconds: 60,
      extra: {
        ...commonExtra,
        assetHint: "USDC",
        assetMint: cfg.solanaNetwork.startsWith("solana:5eykt")
          ? USDC_SOLANA_MAINNET
          : undefined,
        chainFamily: "svm",
        // feePayer is filled by ExactSvmScheme.enhancePaymentRequirements
        // from the CDP (or public) facilitator /supported response.
        ataNote:
          "payTo is the owner pubkey; settle TransferChecked to its USDC ATA. ATA must exist.",
      },
    });
  }

  return accepts;
}
