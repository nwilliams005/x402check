/**
 * Per-tool pricing helpers.
 * Base unit: $0.01 / tool. Deep check: $0.05 (multi-probe + listings + recent
 * on-chain USDC-to-payTo sample). Watch remains $5 / 30 days.
 *
 * Limitation: x402 Exact settles ONE amount per HTTP request. Batch POST charges
 * N × unit as a single DynamicPrice payment · not N separate on-chain settlements.
 */
import type { HTTPRequestContext } from "@x402/core/server";

export const DEFAULT_PRICE_PER_TOOL_USD = 0.01;
export const MAX_BATCH = 25;

export function unitPriceUsd(raw?: string): number {
  const n = Number(raw || DEFAULT_PRICE_PER_TOOL_USD);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PRICE_PER_TOOL_USD;
}

export function money(usd: number): `$${string}` {
  const s = usd.toFixed(6).replace(/\.?0+$/, "");
  return `$${s === "" ? "0" : s}` as `$${string}`;
}

export function countToolsFromContext(ctx: HTTPRequestContext): number {
  const q = ctx.adapter.getQueryParam?.("url");
  if (typeof q === "string" && q.trim()) return 1;
  if (Array.isArray(q) && q.length) return Math.min(MAX_BATCH, q.length);

  const body = ctx.adapter.getBody?.();
  // getBody may be Promise in Hono adapter
  return 1; // sync fallback; async path handled in asyncPrice
}

export async function toolsInRequest(ctx: HTTPRequestContext): Promise<string[]> {
  const urls: string[] = [];
  const q = ctx.adapter.getQueryParam?.("url");
  if (typeof q === "string" && q.trim()) urls.push(q.trim());
  else if (Array.isArray(q)) {
    for (const u of q) if (typeof u === "string" && u.trim()) urls.push(u.trim());
  }

  let body: unknown = ctx.adapter.getBody?.();
  if (body && typeof (body as Promise<unknown>).then === "function") {
    try {
      body = await (body as Promise<unknown>);
    } catch {
      body = undefined;
    }
  }
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    const list = o.urls ?? o.tools ?? o.targets;
    if (Array.isArray(list)) {
      for (const u of list) {
        if (typeof u === "string" && u.trim()) urls.push(u.trim());
      }
    } else if (typeof o.url === "string" && o.url.trim()) {
      urls.push(o.url.trim());
    }
  }

  // de-dupe preserve order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= MAX_BATCH) break;
  }
  return out;
}

export async function dynamicPriceForRequest(
  ctx: HTTPRequestContext,
  unitUsd: number,
): Promise<`$${string}`> {
  const tools = await toolsInRequest(ctx);
  const n = Math.max(1, tools.length); // charge at least 1 if they hit paid route
  return money(n * unitUsd);
}

/** Deep check: multi-probe + listing + recent on-chain sample. */
export const DEEP_CHECK_PRICE_USD = 0.05;
export const DEEP_CHECK_ATOMIC = "50000";

/** Watch subscription: $5 Exact USDC buys 30 days of daily re-checks per URL. */
export const WATCH_PRICE_USD = 5;
export const WATCH_PRICE_ATOMIC = "5000000";
export const WATCH_DURATION_DAYS = 30;
