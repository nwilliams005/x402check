/**
 * Optional Bazaar listing check via CDP discovery (public catalog).
 * Read-only. Failures are non-fatal (caution/info, not avoid).
 */
export interface BazaarCheck {
  checked: boolean;
  listed: boolean | null;
  matchCount: number | null;
  note: string;
}

const CDP_DISCOVERY =
  "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources";

export async function checkBazaarListing(targetUrl: string): Promise<BazaarCheck> {
  try {
    const u = new URL(CDP_DISCOVERY);
    // API may ignore unknown filters; we also filter client-side.
    u.searchParams.set("limit", "50");

    const res = await fetch(u.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "x402check-local/0.1 (read-only bazaar check)",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      return {
        checked: true,
        listed: null,
        matchCount: null,
        note: `CDP discovery returned HTTP ${res.status}; listing unknown.`,
      };
    }

    const data = (await res.json()) as {
      items?: Array<{
        resource?: string;
        accepts?: Array<{ resource?: string }>;
        // some shapes nest URL elsewhere
        url?: string;
      }>;
    };

    const items = data.items || [];
    const target = targetUrl.replace(/\/$/, "").toLowerCase();
    const matches = items.filter((it) => {
      const candidates = [
        it.resource,
        it.url,
        ...(it.accepts || []).map((a) => a.resource),
      ].filter(Boolean) as string[];
      return candidates.some((c) => c.replace(/\/$/, "").toLowerCase() === target);
    });

    // Also fuzzy: host+path prefix match within page of results
    const hostMatches = items.filter((it) => {
      try {
        const candidates = [
          it.resource,
          it.url,
          ...(it.accepts || []).map((a) => a.resource),
        ].filter(Boolean) as string[];
        return candidates.some((c) => {
          const cu = new URL(c);
          const tu = new URL(targetUrl);
          return cu.host === tu.host && cu.pathname === tu.pathname;
        });
      } catch {
        return false;
      }
    });

    const count = Math.max(matches.length, hostMatches.length);
    if (count > 0) {
      return {
        checked: true,
        listed: true,
        matchCount: count,
        note: `Found ${count} matching resource(s) in a CDP discovery sample.`,
      };
    }

    return {
      checked: true,
      listed: false,
      matchCount: 0,
      note:
        "No exact match in the CDP discovery sample page (catalog is large; absence here is not proof of unlisting).",
    };
  } catch (e) {
    return {
      checked: true,
      listed: null,
      matchCount: null,
      note: `Bazaar check failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
