/**
 * Heuristic category ceilings from Oct 31 research (cp0x / x402stats patterns).
 * Not market advice · flags only.
 */
export type PriceCategory =
  | "micro_utility"
  | "search_enrichment"
  | "ai_inference"
  | "discovery_recommend"
  | "execution_transfer"
  | "messaging"
  | "unknown";

const CEILINGS: Record<PriceCategory, number> = {
  micro_utility: 0.01, // ping/time/uuid clones often $0.005
  search_enrichment: 0.05,
  ai_inference: 0.05,
  discovery_recommend: 0.05,
  execution_transfer: 0.15,
  messaging: 0.02,
  unknown: 0.1,
};

export function categorizeUrl(url: string, description?: string | null): PriceCategory {
  const u = url.toLowerCase();
  const d = (description || "").toLowerCase();
  const blob = `${u} ${d}`;

  if (/ping|time|uuid|ip|quote|health|dns|tls|string/.test(blob)) return "micro_utility";
  if (/search|exa|enrich|scrape|crawl/.test(blob)) return "search_enrichment";
  if (/chat\/completions|inference|llm|gpt|claude|generate/.test(blob)) return "ai_inference";
  if (/recommend|discover|bazaar|directory/.test(blob)) return "discovery_recommend";
  if (/send-native|send-token|transfer|swap|execute|smartmoney|smarttraders/.test(blob))
    return "execution_transfer";
  if (/meadow|message|messaging|room|dm/.test(blob)) return "messaging";
  return "unknown";
}

export function categoryCeiling(category: PriceCategory): number {
  return CEILINGS[category];
}

export function atomicToUsd(amountAtomic: string, decimals = 6): number | null {
  try {
    const n = BigInt(amountAtomic);
    return Number(n) / 10 ** decimals;
  } catch {
    return null;
  }
}

export function isHighForCategory(usd: number | null, category: PriceCategory): boolean {
  if (usd == null || Number.isNaN(usd)) return false;
  return usd > categoryCeiling(category);
}
