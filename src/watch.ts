/**
 * $5/month (30-day) watch subscription per tool URL.
 * Agent-native: one Exact USDC payment on Base buys 30 days of daily re-checks.
 * Alerts fire to webhookUrl and/or email (Resend) when payTo, price, network, or availability changes.
 */
import type { Env, ToolCheck, Verdict } from "./types";
import { checkTool, isBlockedHost } from "./preflight";
import { loadToolRecord } from "./history";

export const WATCH_PRICE_USD = 5;
export const WATCH_PRICE_ATOMIC = "5000000"; // 5 USDC, 6 decimals
export const WATCH_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const WATCH_KEY_PREFIX = "watch:sub:";
export const WATCH_MAX_ALERTS = 20;

export type WatchBaseline = {
  payTo: string | null;
  priceUsd: number | null;
  network: string | null;
  reachable: boolean;
  is402: boolean;
  verdict: Verdict;
};

export type WatchAlert = {
  at: string;
  changes: string[];
  baseline: WatchBaseline;
  current: WatchBaseline;
};

export type WatchRecord = {
  id: string;
  url: string;
  webhookUrl: string | null;
  /** Optional email alert via Resend when RESEND_API_KEY is set on the Worker. */
  email: string | null;
  createdAt: string;
  expiresAt: string;
  lastCheckedAt: string | null;
  lastAlertAt: string | null;
  baseline: WatchBaseline;
  alerts: WatchAlert[];
  active: boolean;
};

export function watchKey(id: string): string {
  return `${WATCH_KEY_PREFIX}${id}`;
}

export function baselineFromCheck(c: ToolCheck): WatchBaseline {
  return {
    payTo: c.payTo,
    priceUsd: c.priceUsd,
    network: c.network,
    reachable: c.status !== null && c.status > 0,
    is402: c.is402,
    verdict: c.verdict,
  };
}

export function diffBaseline(
  prev: WatchBaseline,
  next: WatchBaseline,
): string[] {
  const changes: string[] = [];
  const prevPay = (prev.payTo || "").toLowerCase();
  const nextPay = (next.payTo || "").toLowerCase();
  if (prevPay !== nextPay) changes.push("payTo");
  if (prev.priceUsd !== next.priceUsd) changes.push("price");
  if ((prev.network || "") !== (next.network || "")) changes.push("network");
  if (prev.reachable !== next.reachable || prev.is402 !== next.is402) {
    changes.push("availability");
  }
  return changes;
}

function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function loadWatch(
  kv: KVNamespace | undefined,
  id: string,
): Promise<WatchRecord | null> {
  if (!kv || !id) return null;
  const raw = await kv.get(watchKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WatchRecord;
  } catch {
    return null;
  }
}

export async function saveWatch(
  kv: KVNamespace | undefined,
  rec: WatchRecord,
): Promise<void> {
  if (!kv) return;
  const expiresMs = Date.parse(rec.expiresAt) || 0;
  const ttlSec = Math.max(
    60,
    Math.ceil((expiresMs - Date.now()) / 1000) + 7 * 24 * 3600,
  );
  await kv.put(watchKey(rec.id), JSON.stringify(rec), {
    expirationTtl: ttlSec,
  });
}

export type CreateWatchInput = {
  url: string;
  webhookUrl?: string | null;
  email?: string | null;
};

export type CreateWatchResult =
  | { ok: true; watch: WatchRecord; check: ToolCheck }
  | { ok: false; error: string; message: string };

/**
 * Create a 30-day watch after payment has already settled.
 * Runs an initial live check to set the baseline.
 */
export async function createWatch(
  env: Env,
  input: CreateWatchInput,
): Promise<CreateWatchResult> {
  const url = (input.url || "").trim();
  if (!url) {
    return { ok: false, error: "missing_url", message: "Body must include url" };
  }
  if (isBlockedHost(url)) {
    return {
      ok: false,
      error: "blocked_host",
      message: "Refusing private/localhost/metadata hosts.",
    };
  }
  let normalized: string;
  try {
    normalized = new URL(url).toString();
  } catch {
    return { ok: false, error: "invalid_url", message: "url must be absolute http(s)" };
  }

  const webhookUrl = input.webhookUrl?.trim() || null;
  if (webhookUrl && !isHttpsUrl(webhookUrl)) {
    return {
      ok: false,
      error: "invalid_webhook",
      message: "webhookUrl must be https",
    };
  }
  const email = input.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      ok: false,
      error: "invalid_email",
      message: "email looks invalid",
    };
  }

  const prior = await loadToolRecord(env.PAYTO_HISTORY, normalized);
  const check = await checkTool(normalized, env, { forceLive: true });
  const now = new Date();
  const expires = new Date(now.getTime() + WATCH_DURATION_MS);
  const rec: WatchRecord = {
    id: newId(),
    url: normalized,
    webhookUrl,
    email,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    lastCheckedAt: check.checkedAt,
    lastAlertAt: null,
    baseline: baselineFromCheck(check),
    alerts: [],
    active: true,
  };
  await saveWatch(env.PAYTO_HISTORY, rec);
  // touch prior so callers can detect isNewTool if needed
  void prior;
  return { ok: true, watch: publicWatch(rec), check };
}

export function publicWatch(rec: WatchRecord): WatchRecord {
  // Return a copy without mutating; same shape for now.
  return { ...rec, alerts: rec.alerts.slice(0, WATCH_MAX_ALERTS) };
}

export async function renewWatch(
  env: Env,
  watchId: string,
): Promise<CreateWatchResult> {
  const existing = await loadWatch(env.PAYTO_HISTORY, watchId);
  if (!existing) {
    return { ok: false, error: "not_found", message: "Unknown watch id" };
  }
  const now = Date.now();
  const base = Math.max(now, Date.parse(existing.expiresAt) || now);
  existing.expiresAt = new Date(base + WATCH_DURATION_MS).toISOString();
  existing.active = true;
  await saveWatch(env.PAYTO_HISTORY, existing);
  const check = await checkTool(existing.url, env, { forceLive: false });
  return { ok: true, watch: publicWatch(existing), check };
}

export type CronSummary = {
  scanned: number;
  checked: number;
  alerted: number;
  expired: number;
  errors: number;
};

async function postWebhook(
  webhookUrl: string,
  body: unknown,
): Promise<boolean> {
  try {
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "x402check-watch/0.1",
      },
      body: JSON.stringify(body),
    });
    return r.ok || (r.status >= 200 && r.status < 300);
  } catch {
    return false;
  }
}



export type WatchAlertPayload = {
  type: "x402check.watch.alert";
  watchId: string;
  url: string;
  changes: string[];
  baseline: WatchBaseline;
  current: WatchBaseline;
  checkedAt: string;
  expiresAt: string;
  docs: string;
};

export function formatBaselineLine(b: WatchBaseline): string {
  const pay = b.payTo || "(none)";
  const price = b.priceUsd == null ? "(unknown)" : `$${b.priceUsd}`;
  const net = b.network || "(none)";
  const avail = b.reachable
    ? b.is402
      ? "reachable+402"
      : "reachable"
    : "unreachable";
  return `payTo=${pay} price=${price} network=${net} availability=${avail} verdict=${b.verdict}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Send a watch alert via Resend. Returns false when RESEND_API_KEY is unset or the API fails.
 * Uses fetch only — no Resend SDK (keeps the Worker bundle small).
 */
export async function sendWatchEmail(
  env: Env,
  to: string,
  payload: WatchAlertPayload,
): Promise<boolean> {
  const apiKey = (env.RESEND_API_KEY || "").trim();
  if (!apiKey) return false;
  const from =
    (env.RESEND_FROM || "").trim() ||
    "x402check Watch <watch@alerts.x402check.dev>";
  const changeList = payload.changes.join(", ");
  const subject = `x402check watch alert: ${changeList}`;
  const statusUrl = `https://x402check.dev/watch?id=${payload.watchId}`;
  const textBody = [
    "x402check detected a change on a watched x402 seller.",
    "",
    `URL: ${payload.url}`,
    `Changes: ${changeList}`,
    `Checked at: ${payload.checkedAt}`,
    `Watch expires: ${payload.expiresAt}`,
    "",
    `Before: ${formatBaselineLine(payload.baseline)}`,
    `After:  ${formatBaselineLine(payload.current)}`,
    "",
    `Status: ${statusUrl}`,
    `Docs: ${payload.docs}`,
    "",
    "This is a transactional alert for your paid $5 / 30-day watch.",
  ].join("\n");
  const html = `<p>x402check detected a change on a watched x402 seller.</p>
<ul>
<li><strong>URL:</strong> ${escapeHtml(payload.url)}</li>
<li><strong>Changes:</strong> ${escapeHtml(changeList)}</li>
<li><strong>Checked at:</strong> ${escapeHtml(payload.checkedAt)}</li>
<li><strong>Watch expires:</strong> ${escapeHtml(payload.expiresAt)}</li>
</ul>
<p><strong>Before:</strong> <code>${escapeHtml(formatBaselineLine(payload.baseline))}</code><br/>
<strong>After:</strong> <code>${escapeHtml(formatBaselineLine(payload.current))}</code></p>
<p><a href="${escapeHtml(statusUrl)}">Watch status</a> · <a href="${escapeHtml(payload.docs)}">Docs</a></p>
<p style="color:#666;font-size:12px">Transactional alert for your paid $5 / 30-day watch.</p>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": "x402check-watch/0.1",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: textBody,
        html,
        tags: [
          { name: "product", value: "watch" },
          { name: "watch_id", value: payload.watchId.slice(0, 64) },
        ],
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Daily cron: re-check every active, non-expired watch; webhook and/or email on drift.
 */
export async function runWatchCron(env: Env): Promise<CronSummary> {
  const summary: CronSummary = {
    scanned: 0,
    checked: 0,
    alerted: 0,
    expired: 0,
    errors: 0,
  };
  const kv = env.PAYTO_HISTORY;
  if (!kv) return summary;

  let cursor: string | undefined;
  const now = Date.now();
  do {
    const page = await kv.list({ prefix: WATCH_KEY_PREFIX, cursor, limit: 100 });
    cursor = page.list_complete ? undefined : page.cursor;
    for (const key of page.keys) {
      summary.scanned += 1;
      try {
        const raw = await kv.get(key.name);
        if (!raw) continue;
        const rec = JSON.parse(raw) as WatchRecord;
        const exp = Date.parse(rec.expiresAt) || 0;
        if (!rec.active || exp < now) {
          if (rec.active && exp < now) {
            rec.active = false;
            await saveWatch(kv, rec);
            summary.expired += 1;
          }
          continue;
        }
        const check = await checkTool(rec.url, env, { forceLive: true });
        summary.checked += 1;
        const current = baselineFromCheck(check);
        const changes = diffBaseline(rec.baseline, current);
        rec.lastCheckedAt = check.checkedAt;
        if (changes.length) {
          const alert: WatchAlert = {
            at: check.checkedAt,
            changes,
            baseline: rec.baseline,
            current,
          };
          rec.alerts = [alert, ...rec.alerts].slice(0, WATCH_MAX_ALERTS);
          rec.lastAlertAt = check.checkedAt;
          rec.baseline = current; // re-baseline after alert so we don't spam
          const payload: WatchAlertPayload = {
            type: "x402check.watch.alert",
            watchId: rec.id,
            url: rec.url,
            changes,
            baseline: alert.baseline,
            current,
            checkedAt: check.checkedAt,
            expiresAt: rec.expiresAt,
            docs: "https://x402check.dev/docs",
          };
          if (rec.webhookUrl) {
            const ok = await postWebhook(rec.webhookUrl, payload);
            if (!ok) summary.errors += 1;
          }
          if (rec.email) {
            const okMail = await sendWatchEmail(env, rec.email, payload);
            // Missing RESEND_API_KEY: skip without error so unconfigured deploys stay safe
            if (!okMail && (env.RESEND_API_KEY || "").trim()) summary.errors += 1;
          }
          summary.alerted += 1;
        }
        await saveWatch(kv, rec);
      } catch {
        summary.errors += 1;
      }
    }
  } while (cursor);

  return summary;
}

/** Static Base Exact accept for $5 watch (docs / unpaid 402 body fallback). */
export function watchAcceptRequirement(
  payTo: string,
  network: string,
  asset: string,
): Record<string, unknown> {
  return {
    scheme: "exact",
    network,
    amount: WATCH_PRICE_ATOMIC,
    asset,
    payTo,
    maxTimeoutSeconds: 120,
    extra: {
      name: "USD Coin",
      version: "2",
      priceUsd: WATCH_PRICE_USD,
      pricingModel: "watch_30d",
      durationDays: 30,
      assetHint: "USDC",
      chainFamily: "evm",
      product: "watch",
    },
  };
}
