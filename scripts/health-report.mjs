#!/usr/bin/env node
/**
 * Aggregate-only health report from private scan records.
 * NEVER prints endpoint URLs, owners, or payTo addresses.
 *
 * Usage:
 *   node scripts/health-report.mjs --input growth/health-report/sample-scan-records.json
 *   node scripts/health-report.mjs --input path/to/records.json --out growth/health-report/out.json
 *
 * Input JSON: { records: ScanEndpointRecord[] } or ScanEndpointRecord[]
 * where each record has grade, reasons[], status, listedPriceUsd, livePriceUsd, etc.
 * (Same shape as src/scan.ts ScanEndpointRecord, minus any need to display url.)
 */
import { readFileSync, writeFileSync } from "node:fs";

function parseArgs(argv) {
  const out = { input: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--input") out.input = argv[++i];
    else if (argv[i] === "--out") out.out = argv[++i];
  }
  return out;
}

function loadRecords(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const list = Array.isArray(raw) ? raw : raw.records || raw.items || [];
  return list;
}

/** Strip identifying fields if someone passed full records by mistake. */
function scrub(rec) {
  const { grade, reasons, status, live, is402, listedPriceUsd, livePriceUsd, gradedAt, source } = rec;
  return { grade, reasons: reasons || [], status, live, is402, listedPriceUsd, livePriceUsd, gradedAt, source };
}

function aggregate(records) {
  const n = records.length;
  let priceMismatch = 0;
  let stalePayTo = 0;
  let gone = 0;
  let pass = 0;
  let warn = 0;
  let fail = 0;
  let not402 = 0;
  let unreachable = 0;

  for (const r0 of records) {
    const r = scrub(r0);
    if (r.grade === "pass") pass++;
    else if (r.grade === "warn") warn++;
    else if (r.grade === "fail") fail++;

    const reasons = new Set(r.reasons || []);
    if (reasons.has("price_mismatch")) priceMismatch++;
    if (reasons.has("payto_mismatch")) stalePayTo++;
    if (reasons.has("unreachable")) unreachable++;
    if (reasons.has("not_402")) not402++;
    if (r.status === 404 || r.status === 410) gone++;
  }

  const pct = (c) => (n === 0 ? 0 : Math.round((c / n) * 1000) / 10);

  return {
    asOf: new Date().toISOString(),
    listingsChecked: n,
    grades: { pass, warn, fail },
    counts: {
      priceMismatch,
      stalePayTo,
      gone404or410: gone,
      unreachable,
      not402,
    },
    percentOfChecked: {
      priceMismatch: pct(priceMismatch),
      stalePayTo: pct(stalePayTo),
      gone404or410: pct(gone),
      unreachable: pct(unreachable),
      not402: pct(not402),
      fail: pct(fail),
      warn: pct(warn),
      pass: pct(pass),
    },
    privacy: "Aggregate only. No URLs, owners, or payTo addresses are included.",
  };
}

const args = parseArgs(process.argv);
if (!args.input) {
  console.error("Usage: node scripts/health-report.mjs --input records.json [--out out.json]");
  process.exit(1);
}
const agg = aggregate(loadRecords(args.input));
const text = JSON.stringify(agg, null, 2) + "\n";
if (args.out) writeFileSync(args.out, text);
else process.stdout.write(text);
