/**
 * Verified endpoint ownership.
 * Primary: sign a nonce with the endpoint's live payTo (EIP-191 / ERC-1271).
 * Fallback: DNS TXT or /.well-known/x402check-verify.txt containing a token.
 *
 * Sessions are opaque tokens scoped only to endpoints the holder verified.
 * Scan grades are returned only for those endpoints · never for others.
 * Errors are deliberately generic to avoid existence / grade leakage.
 */
import type { Env } from "./types";
import { checkTool, isBlockedHost } from "./preflight";
import {
  hashUrl,
  loadScanRecord,
  normalizeScanUrl,
  type ScanEndpointRecord,
  type ScanGrade,
} from "./scan";
import {
  padTiming,
  randomNonce,
  randomToken,
  rateLimit,
  verifyWalletSignature,
} from "./siwe";

const OWNER_CHAL_PREFIX = "owner:chal:";
const OWNER_DNS_PREFIX = "owner:dns:";
const OWNER_SESS_PREFIX = "owner:sess:";
const OWNER_EP_PREFIX = "owner:ep:"; // urlHash -> ownership
const OWNER_SESS_TTL_SEC = 7 * 24 * 3600; // 7 days
const OWNER_CHAL_TTL_SEC = 600; // 10 min
const GENERIC_DENY = "verification_failed";

export type OwnerChallenge = {
  challengeId: string;
  url: string;
  /** payTo the owner must sign as (revealed only after we confirm the URL is probeable). */
  payTo: string;
  nonce: string;
  expiresAt: string;
  message: string;
  /** DNS / well-known fallback token (same challenge). */
  dnsToken: string;
  dnsTxt: string;
  wellKnownPath: string;
  wellKnownBody: string;
};

export type OwnerSession = {
  token: string;
  /** urlHashes this session may read */
  endpoints: string[];
  createdAt: string;
  expiresAt: string;
};

export type OwnershipRecord = {
  urlHash: string;
  url: string;
  payTo: string | null;
  method: "payto_sig" | "dns" | "wellknown";
  verifiedAt: string;
  /** Optional unguessable badge id when opted in */
  badgeId: string | null;
  badgeOptIn: boolean;
};

function sessKey(token: string): string {
  return `${OWNER_SESS_PREFIX}${token}`;
}
function chalKey(id: string): string {
  return `${OWNER_CHAL_PREFIX}${id}`;
}
function dnsKey(token: string): string {
  return `${OWNER_DNS_PREFIX}${token}`;
}
function epKey(urlHash: string): string {
  return `${OWNER_EP_PREFIX}${urlHash}`;
}

export function buildOwnerMessage(opts: {
  origin: string;
  url: string;
  payTo: string;
  nonce: string;
  expiresAt: string;
}): string {
  return [
    "x402check owner-verify v1",
    `URI: ${opts.origin}/owner/verify`,
    `Endpoint: ${opts.url}`,
    `PayTo: ${opts.payTo}`,
    `Nonce: ${opts.nonce}`,
    `Expires: ${opts.expiresAt}`,
  ].join("\n");
}

export async function loadOwnership(
  kv: KVNamespace,
  urlHash: string,
): Promise<OwnershipRecord | null> {
  const raw = await kv.get(epKey(urlHash));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OwnershipRecord;
  } catch {
    return null;
  }
}

export async function saveOwnership(
  kv: KVNamespace,
  rec: OwnershipRecord,
): Promise<void> {
  await kv.put(epKey(rec.urlHash), JSON.stringify(rec));
}

export async function loadSession(
  kv: KVNamespace,
  token: string | null | undefined,
): Promise<OwnerSession | null> {
  if (!token || !/^[0-9a-f]{32,128}$/i.test(token)) return null;
  const raw = await kv.get(sessKey(token));
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as OwnerSession;
    if (Date.parse(s.expiresAt) < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

async function saveSession(kv: KVNamespace, s: OwnerSession): Promise<void> {
  await kv.put(sessKey(s.token), JSON.stringify(s), {
    expirationTtl: OWNER_SESS_TTL_SEC,
  });
}

async function grantEndpointToSession(
  kv: KVNamespace,
  session: OwnerSession | null,
  urlHash: string,
): Promise<OwnerSession> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OWNER_SESS_TTL_SEC * 1000).toISOString();
  if (session) {
    const endpoints = [...new Set([...session.endpoints, urlHash])];
    const next: OwnerSession = {
      ...session,
      endpoints,
      expiresAt,
    };
    await saveSession(kv, next);
    return next;
  }
  const next: OwnerSession = {
    token: randomToken(32),
    endpoints: [urlHash],
    createdAt: now.toISOString(),
    expiresAt,
  };
  await saveSession(kv, next);
  return next;
}

/**
 * Issue an owner challenge for a URL.
 * Always returns a generic shape; does not reveal whether we have a prior scan grade.
 * We do a live probe to learn payTo (needed for primary verify). If unreachable,
 * still offer DNS fallback with a token (no payTo sig path).
 */
export async function issueOwnerChallenge(
  env: Env,
  opts: { url: string; origin: string; clientIp: string },
): Promise<
  | { ok: true; challenge: OwnerChallenge }
  | { ok: false; error: string; status: number }
> {
  const t0 = Date.now();
  const rl = await rateLimit(
    env.PAYTO_HISTORY,
    `rl:owner:chal:ip:${opts.clientIp || "unknown"}`,
    20,
    3600,
  );
  if (!rl.allowed) {
    await padTiming(t0);
    return { ok: false, error: "rate_limited", status: 429 };
  }

  let url: string;
  try {
    url = normalizeScanUrl(opts.url);
  } catch {
    await padTiming(t0);
    return { ok: false, error: "invalid_url", status: 400 };
  }
  if (isBlockedHost(url)) {
    await padTiming(t0);
    return { ok: false, error: "invalid_url", status: 400 };
  }

  // Live probe for payTo · do not return grade/reasons
  let payTo = "";
  try {
    const check = await checkTool(url, env, { forceLive: true });
    payTo = (check.payTo || "").toLowerCase();
  } catch {
    payTo = "";
  }

  const challengeId = randomToken(16);
  const nonce = randomNonce();
  const dnsToken = randomToken(24);
  const expiresAt = new Date(Date.now() + OWNER_CHAL_TTL_SEC * 1000).toISOString();
  const message = payTo
    ? buildOwnerMessage({
        origin: opts.origin,
        url,
        payTo,
        nonce,
        expiresAt,
      })
    : "";

  const host = new URL(url).hostname;
  const payload = {
    challengeId,
    url,
    payTo,
    nonce,
    expiresAt,
    dnsToken,
  };
  await env.PAYTO_HISTORY.put(chalKey(challengeId), JSON.stringify(payload), {
    expirationTtl: OWNER_CHAL_TTL_SEC,
  });
  await env.PAYTO_HISTORY.put(
    dnsKey(dnsToken),
    JSON.stringify({ challengeId, url, expiresAt }),
    { expirationTtl: OWNER_CHAL_TTL_SEC },
  );

  await padTiming(t0);
  return {
    ok: true,
    challenge: {
      challengeId,
      url,
      payTo: payTo || "",
      nonce,
      expiresAt,
      message,
      dnsToken,
      dnsTxt: `x402check-verify=${dnsToken}`,
      wellKnownPath: `https://${host}/.well-known/x402check-verify.txt`,
      wellKnownBody: dnsToken,
    },
  };
}

export async function verifyOwnerPayTo(
  env: Env,
  opts: {
    origin: string;
    clientIp: string;
    challengeId: string;
    signature: string;
    sessionToken?: string | null;
  },
): Promise<
  | { ok: true; sessionToken: string; url: string }
  | { ok: false; error: string; status: number }
> {
  const t0 = Date.now();
  const rl = await rateLimit(
    env.PAYTO_HISTORY,
    `rl:owner:verify:ip:${opts.clientIp || "unknown"}`,
    30,
    3600,
  );
  if (!rl.allowed) {
    await padTiming(t0);
    return { ok: false, error: "rate_limited", status: 429 };
  }

  const raw = await env.PAYTO_HISTORY.get(chalKey(opts.challengeId));
  if (!raw) {
    await padTiming(t0);
    return { ok: false, error: GENERIC_DENY, status: 400 };
  }
  let chal: {
    challengeId: string;
    url: string;
    payTo: string;
    nonce: string;
    expiresAt: string;
    dnsToken: string;
  };
  try {
    chal = JSON.parse(raw) as typeof chal;
  } catch {
    await padTiming(t0);
    return { ok: false, error: GENERIC_DENY, status: 400 };
  }
  if (Date.parse(chal.expiresAt) < Date.now() || !chal.payTo) {
    await padTiming(t0);
    return { ok: false, error: GENERIC_DENY, status: 400 };
  }

  const message = buildOwnerMessage({
    origin: opts.origin,
    url: chal.url,
    payTo: chal.payTo,
    nonce: chal.nonce,
    expiresAt: chal.expiresAt,
  });
  const verified = await verifyWalletSignature({
    address: chal.payTo,
    message,
    signature: opts.signature,
  });
  if (!verified.ok) {
    await padTiming(t0);
    return { ok: false, error: GENERIC_DENY, status: 401 };
  }

  const urlHash = await hashUrl(chal.url);
  const ownership: OwnershipRecord = {
    urlHash,
    url: chal.url,
    payTo: chal.payTo,
    method: "payto_sig",
    verifiedAt: new Date().toISOString(),
    badgeId: null,
    badgeOptIn: false,
  };
  // Preserve existing badge opt-in if re-verifying
  const prev = await loadOwnership(env.PAYTO_HISTORY, urlHash);
  if (prev?.badgeOptIn && prev.badgeId) {
    ownership.badgeOptIn = true;
    ownership.badgeId = prev.badgeId;
  }
  await saveOwnership(env.PAYTO_HISTORY, ownership);

  const existing = await loadSession(env.PAYTO_HISTORY, opts.sessionToken);
  const session = await grantEndpointToSession(env.PAYTO_HISTORY, existing, urlHash);

  // burn challenge
  await env.PAYTO_HISTORY.put(chalKey(opts.challengeId), "", { expirationTtl: 60 });

  await padTiming(t0);
  return { ok: true, sessionToken: session.token, url: chal.url };
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "x402check-owner-verify/0.1" },
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function verifyOwnerDnsOrWellKnown(
  env: Env,
  opts: {
    clientIp: string;
    challengeId: string;
    method: "dns" | "wellknown";
    sessionToken?: string | null;
  },
): Promise<
  | { ok: true; sessionToken: string; url: string }
  | { ok: false; error: string; status: number }
> {
  const t0 = Date.now();
  const rl = await rateLimit(
    env.PAYTO_HISTORY,
    `rl:owner:dns:ip:${opts.clientIp || "unknown"}`,
    20,
    3600,
  );
  if (!rl.allowed) {
    await padTiming(t0);
    return { ok: false, error: "rate_limited", status: 429 };
  }

  const raw = await env.PAYTO_HISTORY.get(chalKey(opts.challengeId));
  if (!raw) {
    await padTiming(t0);
    return { ok: false, error: GENERIC_DENY, status: 400 };
  }
  let chal: {
    challengeId: string;
    url: string;
    payTo: string;
    nonce: string;
    expiresAt: string;
    dnsToken: string;
  };
  try {
    chal = JSON.parse(raw) as typeof chal;
  } catch {
    await padTiming(t0);
    return { ok: false, error: GENERIC_DENY, status: 400 };
  }
  if (Date.parse(chal.expiresAt) < Date.now()) {
    await padTiming(t0);
    return { ok: false, error: GENERIC_DENY, status: 400 };
  }

  const host = new URL(chal.url).hostname;
  let found = false;
  if (opts.method === "wellknown") {
    const body = await fetchText(
      `https://${host}/.well-known/x402check-verify.txt`,
    );
    if (body && body.trim().includes(chal.dnsToken)) found = true;
  } else {
    // DNS TXT via Google DNS-over-HTTPS (public, no auth)
    try {
      const doh = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=TXT`,
        {
          headers: { Accept: "application/dns-json" },
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (doh.ok) {
        const j = (await doh.json()) as {
          Answer?: Array<{ data?: string }>;
        };
        const blob = (j.Answer || [])
          .map((a) => (a.data || "").replace(/^"|"$/g, ""))
          .join(" ");
        if (blob.includes(`x402check-verify=${chal.dnsToken}`) || blob.includes(chal.dnsToken)) {
          found = true;
        }
      }
    } catch {
      found = false;
    }
  }

  if (!found) {
    await padTiming(t0);
    return { ok: false, error: GENERIC_DENY, status: 401 };
  }

  const urlHash = await hashUrl(chal.url);
  const ownership: OwnershipRecord = {
    urlHash,
    url: chal.url,
    payTo: chal.payTo || null,
    method: opts.method === "dns" ? "dns" : "wellknown",
    verifiedAt: new Date().toISOString(),
    badgeId: null,
    badgeOptIn: false,
  };
  const prev = await loadOwnership(env.PAYTO_HISTORY, urlHash);
  if (prev?.badgeOptIn && prev.badgeId) {
    ownership.badgeOptIn = true;
    ownership.badgeId = prev.badgeId;
  }
  await saveOwnership(env.PAYTO_HISTORY, ownership);

  const existing = await loadSession(env.PAYTO_HISTORY, opts.sessionToken);
  const session = await grantEndpointToSession(env.PAYTO_HISTORY, existing, urlHash);
  await env.PAYTO_HISTORY.put(chalKey(opts.challengeId), "", { expirationTtl: 60 });

  await padTiming(t0);
  return { ok: true, sessionToken: session.token, url: chal.url };
}

export type OwnerDashboardEndpoint = {
  url: string;
  verifiedAt: string;
  verifyMethod: OwnershipRecord["method"];
  /** Periodic snapshot · not a live paid check */
  snapshot: {
    grade: ScanGrade | "unknown";
    gradedAt: string | null;
    reasons: string[];
    livePriceUsd: number | null;
    livePayTo: string | null;
    listedPriceUsd: number | null;
    note: string;
  };
  badge: {
    optedIn: boolean;
    badgeId: string | null;
    embedUrl: string | null;
    status: "active" | "inactive" | "revoked_or_off";
  };
  upsells: {
    watch: string;
    paidCheck: string;
  };
};

/**
 * Return dashboard data ONLY for endpoints on the session.
 * Unknown / unauthorized hashes are silently omitted (no leak).
 */
export async function ownerDashboard(
  env: Env,
  opts: { sessionToken: string; origin: string },
): Promise<
  | { ok: true; endpoints: OwnerDashboardEndpoint[] }
  | { ok: false; error: string; status: number }
> {
  const t0 = Date.now();
  const session = await loadSession(env.PAYTO_HISTORY, opts.sessionToken);
  if (!session) {
    await padTiming(t0);
    return { ok: false, error: "unauthorized", status: 401 };
  }

  const endpoints: OwnerDashboardEndpoint[] = [];
  for (const urlHash of session.endpoints) {
    const ownership = await loadOwnership(env.PAYTO_HISTORY, urlHash);
    if (!ownership) continue;
    const scan = await loadScanRecord(env.PAYTO_HISTORY, urlHash);
    const opted = !!(ownership.badgeOptIn && ownership.badgeId);
    endpoints.push({
      url: ownership.url,
      verifiedAt: ownership.verifiedAt,
      verifyMethod: ownership.method,
      snapshot: {
        grade: scan?.grade ?? "unknown",
        gradedAt: scan?.gradedAt ?? null,
        reasons: scan?.reasons ?? [],
        livePriceUsd: scan?.livePriceUsd ?? null,
        livePayTo: scan?.livePayTo ?? null,
        listedPriceUsd: scan?.listedPriceUsd ?? null,
        note:
          scan?.note ||
          "No periodic snapshot yet. Live verification still requires a paid /preflight check.",
      },
      badge: {
        optedIn: opted,
        badgeId: opted ? ownership.badgeId : null,
        embedUrl:
          opted && ownership.badgeId
            ? `${opts.origin}/badge/${ownership.badgeId}.svg`
            : null,
        status: opted ? "active" : "revoked_or_off",
      },
      upsells: {
        watch: `POST ${opts.origin}/watch with {url} · $5 Exact / 30 days of daily re-checks + alerts.`,
        paidCheck: `GET ${opts.origin}/preflight?url=… · $${/* filled by caller docs */ 0.01} live check (not a snapshot).`,
      },
    });
  }

  await padTiming(t0);
  return { ok: true, endpoints };
}
