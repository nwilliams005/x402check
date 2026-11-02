/**
 * "Verified by x402check" embeddable badge.
 * Only for verified owners who opt in. Badge IDs are unguessable.
 * Unknown / revoked / non-pass badges return a generic empty 404-equivalent
 * with no useful body (no URL leakage, no enumeration).
 */
import type { Env } from "./types";
import { loadOwnership, saveOwnership, loadSession, type OwnershipRecord } from "./owner";
import { loadScanRecord, normalizeScanUrl } from "./scan";
import { padTiming, randomToken, rateLimit } from "./siwe";

const BADGE_ID_PREFIX = "badge:id:"; // badgeId -> urlHash

export async function resolveBadgeId(
  kv: KVNamespace,
  badgeId: string,
): Promise<string | null> {
  if (!/^[0-9a-f]{32,128}$/i.test(badgeId)) return null;
  return kv.get(`${BADGE_ID_PREFIX}${badgeId.toLowerCase()}`);
}

export async function optInBadge(
  env: Env,
  opts: { sessionToken: string; url: string },
): Promise<
  | { ok: true; badgeId: string; embedPath: string }
  | { ok: false; error: string; status: number }
> {
  const t0 = Date.now();
  const session = await loadSession(env.PAYTO_HISTORY, opts.sessionToken);
  if (!session) {
    await padTiming(t0);
    return { ok: false, error: "unauthorized", status: 401 };
  }

  let targetUrl = opts.url;
  try {
    targetUrl = normalizeScanUrl(opts.url);
  } catch {
    await padTiming(t0);
    return { ok: false, error: "not_found", status: 404 };
  }
  let urlHash: string | null = null;
  let ownership: OwnershipRecord | null = null;
  for (const h of session.endpoints) {
    const o = await loadOwnership(env.PAYTO_HISTORY, h);
    if (o && o.url === targetUrl) {
      urlHash = h;
      ownership = o;
      break;
    }
  }
  if (!ownership) {
    await padTiming(t0);
    // Same generic error whether URL unknown or not owned — no leak
    return { ok: false, error: "not_found", status: 404 };
  }
  if (!session.endpoints.includes(urlHash!)) {
    await padTiming(t0);
    return { ok: false, error: "not_found", status: 404 };
  }

  // Reuse existing badge id if present
  let badgeId = ownership.badgeId;
  if (!badgeId) {
    badgeId = randomToken(24);
    await env.PAYTO_HISTORY.put(
      `${BADGE_ID_PREFIX}${badgeId}`,
      ownership.urlHash,
    );
  } else {
    await env.PAYTO_HISTORY.put(
      `${BADGE_ID_PREFIX}${badgeId}`,
      ownership.urlHash,
    );
  }
  ownership.badgeId = badgeId;
  ownership.badgeOptIn = true;
  await saveOwnership(env.PAYTO_HISTORY, ownership);
  await padTiming(t0);
  return { ok: true, badgeId, embedPath: `/badge/${badgeId}.svg` };
}

export async function revokeBadge(
  env: Env,
  opts: { sessionToken: string; url: string },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const t0 = Date.now();
  const session = await loadSession(env.PAYTO_HISTORY, opts.sessionToken);
  if (!session) {
    await padTiming(t0);
    return { ok: false, error: "unauthorized", status: 401 };
  }
  let targetUrl = opts.url;
  try {
    targetUrl = normalizeScanUrl(opts.url);
  } catch {
    await padTiming(t0);
    return { ok: false, error: "not_found", status: 404 };
  }
  let ownership: OwnershipRecord | null = null;
  for (const h of session.endpoints) {
    const o = await loadOwnership(env.PAYTO_HISTORY, h);
    if (o && o.url === targetUrl) {
      ownership = o;
      break;
    }
  }
  if (!ownership) {
    await padTiming(t0);
    return { ok: false, error: "not_found", status: 404 };
  }
  if (ownership.badgeId) {
    await env.PAYTO_HISTORY.put(`${BADGE_ID_PREFIX}${ownership.badgeId}`, "", {
      expirationTtl: 60,
    });
  }
  ownership.badgeOptIn = false;
  ownership.badgeId = null;
  await saveOwnership(env.PAYTO_HISTORY, ownership);
  await padTiming(t0);
  return { ok: true };
}

/** Hand-crafted minimal SVG — no AI-slop art. */
export function badgeSvg(opts: {
  gradeLabel: string;
  dateLabel: string;
  origin: string;
}): string {
  // Simple dark pill with green check and monospace date
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="44" viewBox="0 0 220 44" role="img" aria-label="Verified by x402check">
  <title>Verified by x402check</title>
  <rect width="220" height="44" rx="8" fill="#0e1520" stroke="#1e2a3a" stroke-width="2"/>
  <path d="M14 22l5 5 10-12" fill="none" stroke="#7dd3a7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="38" y="18" fill="#e8eef7" font-family="ui-sans-serif,system-ui,sans-serif" font-size="11" font-weight="700">Verified by x402check</text>
  <text x="38" y="34" fill="#9fb3c8" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="10">${opts.gradeLabel} · ${opts.dateLabel}</text>
</svg>`;
}

/**
 * Public badge fetch. Unknown ids, revoked, non-opt-in, or non-pass → empty 404.
 * Rate-limited lightly. No JSON error bodies that reveal why.
 */
export async function renderPublicBadge(
  env: Env,
  opts: { badgeId: string; origin: string; clientIp: string },
): Promise<{ status: number; body: string; contentType: string }> {
  const t0 = Date.now();
  const empty = {
    status: 404,
    body: "",
    contentType: "text/plain; charset=utf-8",
  };

  const rl = await rateLimit(
    env.PAYTO_HISTORY,
    `rl:badge:ip:${opts.clientIp || "unknown"}`,
    120,
    3600,
  );
  if (!rl.allowed) {
    await padTiming(t0);
    return empty;
  }

  const id = (opts.badgeId || "").replace(/\.svg$/i, "").toLowerCase();
  const urlHash = await resolveBadgeId(env.PAYTO_HISTORY, id);
  if (!urlHash) {
    await padTiming(t0);
    return empty;
  }
  const ownership = await loadOwnership(env.PAYTO_HISTORY, urlHash);
  if (!ownership || !ownership.badgeOptIn || ownership.badgeId !== id) {
    await padTiming(t0);
    return empty;
  }
  const scan = await loadScanRecord(env.PAYTO_HISTORY, urlHash);
  // Only serve a useful badge when the latest snapshot is pass
  if (!scan || scan.grade !== "pass") {
    await padTiming(t0);
    return empty;
  }

  const dateLabel = (scan.gradedAt || "").slice(0, 10) || "unknown";
  const svg = badgeSvg({
    gradeLabel: "pass",
    dateLabel,
    origin: opts.origin,
  });
  await padTiming(t0);
  return {
    status: 200,
    body: svg,
    contentType: "image/svg+xml; charset=utf-8",
  };
}

export function badgeEmbedSnippet(origin: string, badgeId: string): string {
  const src = `${origin}/badge/${badgeId}.svg`;
  return `<a href="${origin}/scan" title="Verified by x402check"><img src="${src}" alt="Verified by x402check" width="220" height="44" /></a>`;
}
