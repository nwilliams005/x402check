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
  // Return the raw record so the paid create response can confirm email/webhook once.
  // GET /watch uses publicWatch() and redacts those fields.
  return { ok: true, watch: rec, check };
}

/** Mask an email for status responses (never return the full address on GET). */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const keep = local.slice(0, 1) || "*";
  return `${keep}***@${domain}`;
}

export type PublicWatch = Omit<WatchRecord, "email" | "webhookUrl"> & {
  /** Always null on public status responses. */
  email: null;
  /** Always null on public status responses. */
  webhookUrl: null;
  hasEmail: boolean;
  hasWebhook: boolean;
  emailMasked: string | null;
};

/**
 * Public watch status view. Redacts email and webhookUrl so a leaked watch id
 * cannot expose subscriber contact details. Create/renew HTTP handlers that need
 * the clear values should read the raw WatchRecord before calling this.
 */
export function publicWatch(rec: WatchRecord): PublicWatch {
  return {
    ...rec,
    alerts: rec.alerts.slice(0, WATCH_MAX_ALERTS),
    email: null,
    webhookUrl: null,
    hasEmail: Boolean(rec.email),
    hasWebhook: Boolean(rec.webhookUrl),
    emailMasked: rec.email ? maskEmail(rec.email) : null,
  };
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
  return { ok: true, watch: existing, check };
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
  const pay = shortenAddress(b.payTo) || "(none)";
  const price = b.priceUsd == null ? "(unknown)" : `$${b.priceUsd}`;
  const net = b.network || "(none)";
  const avail = availabilityLabel(b);
  return `payTo=${pay} price=${price} network=${net} availability=${avail} verdict=${b.verdict}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** e.g. Nov 2, 2026, 12:44 PM UTC */
export function formatWatchTimeUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const mm = m.toString().padStart(2, "0");
  return `${month} ${day}, ${year}, ${h}:${mm} ${ampm} UTC`;
}

/** 0x0000…0001 · empty/null → "" */
export function shortenAddress(addr: string | null | undefined): string {
  if (!addr) return "";
  const a = addr.trim();
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function availabilityLabel(b: WatchBaseline): string {
  if (!b.reachable) return "unreachable";
  return b.is402 ? "reachable+402" : "reachable";
}

function fieldValues(b: WatchBaseline): {
  payTo: string;
  price: string;
  network: string;
  availability: string;
  verdict: string;
} {
  return {
    payTo: b.payTo || "(none)",
    price: b.priceUsd == null ? "(unknown)" : `$${b.priceUsd}`,
    network: b.network || "(none)",
    availability: availabilityLabel(b),
    verdict: b.verdict,
  };
}

type CompareRow = {
  key: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
};

function compareRows(before: WatchBaseline, after: WatchBaseline): CompareRow[] {
  const b = fieldValues(before);
  const a = fieldValues(after);
  const rows: Array<{ key: keyof typeof b; label: string }> = [
    { key: "payTo", label: "payTo" },
    { key: "price", label: "price" },
    { key: "network", label: "network" },
    { key: "availability", label: "availability" },
    { key: "verdict", label: "verdict" },
  ];
  return rows.map(({ key, label }) => ({
    key,
    label,
    before: b[key],
    after: a[key],
    changed: b[key] !== a[key],
  }));
}

function displayValue(key: string, raw: string): string {
  if (key === "payTo" && raw.startsWith("0x") && raw.length >= 12) {
    return shortenAddress(raw);
  }
  return raw;
}

function formatCompareText(rows: CompareRow[]): string {
  const lines = ["Field          Before              After"];
  lines.push("-".repeat(52));
  for (const r of rows) {
    const mark = r.changed ? "*" : " ";
    const before = displayValue(r.key, r.before);
    const after = displayValue(r.key, r.after);
    lines.push(
      `${mark}${r.label.padEnd(13)} ${before.padEnd(18)} ${after}${r.changed ? "  (changed)" : ""}`,
    );
  }
  for (const r of rows) {
    if (r.key !== "payTo") continue;
    const shortEnough =
      (r.before.startsWith("0x") && r.before.length >= 12) ||
      (r.after.startsWith("0x") && r.after.length >= 12);
    if (!shortEnough) continue;
    if (r.before === r.after) {
      lines.push(`  payTo (full): ${r.after}`);
    } else {
      if (r.before.startsWith("0x") && r.before.length >= 12) {
        lines.push(`  payTo before (full): ${r.before}`);
      }
      if (r.after.startsWith("0x") && r.after.length >= 12) {
        lines.push(`  payTo after (full):  ${r.after}`);
      }
    }
  }
  return lines.join("\n");
}

function formatCompareHtml(rows: CompareRow[]): string {
  const body = rows
    .map((r) => {
      const bg = r.changed ? "background:#fff7e6;" : "";
      const weight = r.changed ? "font-weight:600;" : "";
      const beforeShow = displayValue(r.key, r.before);
      const afterShow = displayValue(r.key, r.after);
      const beforeTitle =
        r.key === "payTo" && r.before.startsWith("0x")
          ? ` title="${escapeHtml(r.before)}"`
          : "";
      const afterTitle =
        r.key === "payTo" && r.after.startsWith("0x")
          ? ` title="${escapeHtml(r.after)}"`
          : "";
      const fullPay =
        r.key === "payTo" &&
        ((r.before.startsWith("0x") && r.before.length >= 12) ||
          (r.after.startsWith("0x") && r.after.length >= 12))
          ? `<div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:#666;word-break:break-all;margin-top:4px">${
              r.before === r.after
                ? escapeHtml(r.after)
                : `before: ${escapeHtml(r.before)}<br/>after: ${escapeHtml(r.after)}`
            }</div>`
          : "";
      return `<tr style="${bg}">
  <td style="padding:8px 10px;border-bottom:1px solid #e8e8e8;${weight}">${escapeHtml(r.label)}${r.changed ? ' <span style="color:#b45309;font-size:11px">changed</span>' : ""}</td>
  <td style="padding:8px 10px;border-bottom:1px solid #e8e8e8;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px"${beforeTitle}>${escapeHtml(beforeShow)}</td>
  <td style="padding:8px 10px;border-bottom:1px solid #e8e8e8;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px"${afterTitle}>${escapeHtml(afterShow)}</td>
</tr>${fullPay ? `<tr style="${bg}"><td colspan="3" style="padding:0 10px 8px;border-bottom:1px solid #e8e8e8">${fullPay}</td></tr>` : ""}`;
    })
    .join("\n");
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;max-width:560px;font-size:14px;color:#111">
<thead>
<tr>
  <th align="left" style="padding:8px 10px;border-bottom:2px solid #ddd;font-size:12px;color:#555">Field</th>
  <th align="left" style="padding:8px 10px;border-bottom:2px solid #ddd;font-size:12px;color:#555">Before</th>
  <th align="left" style="padding:8px 10px;border-bottom:2px solid #ddd;font-size:12px;color:#555">After</th>
</tr>
</thead>
<tbody>
${body}
</tbody>
</table>`;
}

/**
 * Send a watch alert via Resend. Returns false when RESEND_API_KEY is unset or the API fails.
 * Uses fetch only · no Resend SDK (keeps the Worker bundle small).
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
  const checkedHuman = formatWatchTimeUtc(payload.checkedAt);
  const expiresHuman = formatWatchTimeUtc(payload.expiresAt);
  const rows = compareRows(payload.baseline, payload.current);
  const compareText = formatCompareText(rows);
  const textBody = [
    "x402check detected a change on a watched x402 seller.",
    "",
    `URL: ${payload.url}`,
    `Changes: ${changeList}`,
    `Checked at: ${checkedHuman}`,
    `  (${payload.checkedAt})`,
    `Watch expires: ${expiresHuman}`,
    `  (${payload.expiresAt})`,
    "",
    "Before → After",
    compareText,
    "",
    `Status: ${statusUrl}`,
    `Docs: ${payload.docs}`,
    "",
    "This is a transactional alert for your paid $5 / 30-day watch.",
  ].join("\n");
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.45;color:#111;max-width:600px">
<p style="margin:0 0 12px">x402check detected a change on a watched x402 seller.</p>
<p style="margin:0 0 8px"><strong>URL:</strong> <a href="${escapeHtml(payload.url)}">${escapeHtml(payload.url)}</a></p>
<p style="margin:0 0 8px"><strong>Changes:</strong> ${escapeHtml(changeList)}</p>
<p style="margin:0 0 4px"><strong>Checked at:</strong> ${escapeHtml(checkedHuman)}</p>
<p style="margin:0 0 8px;font-size:12px;color:#666">${escapeHtml(payload.checkedAt)}</p>
<p style="margin:0 0 4px"><strong>Watch expires:</strong> ${escapeHtml(expiresHuman)}</p>
<p style="margin:0 0 16px;font-size:12px;color:#666">${escapeHtml(payload.expiresAt)}</p>
<p style="margin:0 0 8px"><strong>Before → After</strong></p>
${formatCompareHtml(rows)}
<p style="margin:16px 0 8px"><a href="${escapeHtml(statusUrl)}">Watch status</a> · <a href="${escapeHtml(payload.docs)}">Docs</a></p>
<p style="margin:0;color:#666;font-size:12px">Transactional alert for your paid $5 / 30-day watch.</p>
</div>`;
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
