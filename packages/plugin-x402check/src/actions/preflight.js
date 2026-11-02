import { preflight, preflightBatch } from "x402check-client";

function getBase(runtime) {
  return (
    runtime?.getSetting?.("X402CHECK_URL") ||
    process.env.X402CHECK_URL ||
    "https://x402check.dev"
  );
}

function extractUrl(text = "") {
  const m = String(text).match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0].replace(/[),.;]+$/, "") : null;
}

function extractUrls(text = "") {
  const found = String(text).match(/https?:\/\/[^\s"'<>]+/gi) || [];
  return [...new Set(found.map((u) => u.replace(/[),.;]+$/, "")))].slice(0, 25);
}

export const preflightCheckAction = {
  name: "X402CHECK_PREFLIGHT",
  description:
    "Trust-check an x402 seller URL before paying. Returns verdict ok|caution|avoid plus payTo, price, and history. Do not pay if avoid. Use before PAYMENT-SIGNATURE when asking if an endpoint is safe.",
  similes: [
    "preflight x402",
    "check x402 endpoint",
    "is this x402 safe",
    "x402check",
    "trust check before pay",
  ],
  validate: async (_runtime, message) => {
    const text = message?.content?.text || "";
    return /x402|preflight|payto|before pay|seller/i.test(text) || !!extractUrl(text);
  },
  handler: async (runtime, message, _state, _opts, callback) => {
    const url = extractUrl(message?.content?.text || "");
    if (!url) {
      const text = "Provide an https seller URL to preflight.";
      if (callback) await callback({ text });
      return { success: false, text, error: "missing_url" };
    }
    try {
      const check = await preflight(url, { baseUrl: getBase(runtime) });
      const text = `x402check ${check.verdict} for ${url}\npayTo=${check.payTo ?? "n/a"} priceUsd=${check.priceUsd ?? "n/a"}\nreasons=${(check.reasonCodes || []).join(",") || "none"}`;
      if (callback) await callback({ text, actions: ["X402CHECK_PREFLIGHT"] });
      return { success: true, text, data: check, values: { verdict: check.verdict, payTo: check.payTo } };
    } catch (e) {
      const text = `x402check failed: ${e?.message || e}`;
      if (callback) await callback({ text });
      return { success: false, text, error: String(e?.message || e) };
    }
  },
  examples: [
    [
      { name: "{{user1}}", content: { text: "Is https://seller.example/x402 safe to pay?" } },
      { name: "{{agent}}", content: { text: "Running x402check preflight…", actions: ["X402CHECK_PREFLIGHT"] } },
    ],
  ],
};

export const verifyPaytoAction = {
  name: "X402CHECK_VERIFY_PAYTO",
  description:
    "Verify the payTo / receiving wallet an x402 seller demands before signing USDC on Base. Surfaces payToChanges and priceChanges.",
  similes: ["verify payto", "check receiving wallet", "which address am I paying"],
  validate: async (_runtime, message) => {
    const text = message?.content?.text || "";
    return /payto|receiving wallet|which address/i.test(text) || !!extractUrl(text);
  },
  handler: async (runtime, message, _state, _opts, callback) => {
    const url = extractUrl(message?.content?.text || "");
    if (!url) {
      const text = "Provide an https seller URL to verify payTo.";
      if (callback) await callback({ text });
      return { success: false, text, error: "missing_url" };
    }
    try {
      const check = await preflight(url, { baseUrl: getBase(runtime) });
      const text = `payTo=${check.payTo ?? "n/a"} verdict=${check.verdict} priceUsd=${check.priceUsd ?? "n/a"} changes=${JSON.stringify(check.history?.payToChanges || [])}`;
      if (callback) await callback({ text, actions: ["X402CHECK_VERIFY_PAYTO"] });
      return { success: true, text, data: check, values: { payTo: check.payTo, verdict: check.verdict } };
    } catch (e) {
      const text = `verify_payto failed: ${e?.message || e}`;
      if (callback) await callback({ text });
      return { success: false, text, error: String(e?.message || e) };
    }
  },
  examples: [
    [
      { name: "{{user1}}", content: { text: "Verify payTo for https://seller.example/x402" } },
      { name: "{{agent}}", content: { text: "Checking payTo…", actions: ["X402CHECK_VERIFY_PAYTO"] } },
    ],
  ],
};

export const compareToolsAction = {
  name: "X402CHECK_COMPARE_TOOLS",
  description:
    "Compare several x402 seller URLs before choosing which to pay. Returns verdicts, prices, payTo, and drift history.",
  similes: ["compare x402 tools", "which seller is safer", "pick reliable x402"],
  validate: async (_runtime, message) => {
    const urls = extractUrls(message?.content?.text || "");
    return urls.length >= 2 || /compare.*(x402|tool|seller)/i.test(message?.content?.text || "");
  },
  handler: async (runtime, message, _state, _opts, callback) => {
    const urls = extractUrls(message?.content?.text || "");
    if (urls.length < 1) {
      const text = "Provide at least one https seller URL to compare.";
      if (callback) await callback({ text });
      return { success: false, text, error: "missing_urls" };
    }
    try {
      const batch = await preflightBatch(urls, { baseUrl: getBase(runtime) });
      const lines = (batch.results || batch || []).map?.(
        (c) => `${c.verdict} ${c.url} payTo=${c.payTo ?? "n/a"} $${c.priceUsd ?? "?"}`,
      ) || [JSON.stringify(batch)];
      const text = lines.join("\n");
      if (callback) await callback({ text, actions: ["X402CHECK_COMPARE_TOOLS"] });
      return { success: true, text, data: batch };
    } catch (e) {
      const text = `compare_tools failed: ${e?.message || e}`;
      if (callback) await callback({ text });
      return { success: false, text, error: String(e?.message || e) };
    }
  },
  examples: [
    [
      { name: "{{user1}}", content: { text: "Compare https://a.example/x402 and https://b.example/x402" } },
      { name: "{{agent}}", content: { text: "Comparing…", actions: ["X402CHECK_COMPARE_TOOLS"] } },
    ],
  ],
};
