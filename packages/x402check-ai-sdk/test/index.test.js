import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createX402CheckTools, beforePayment } from "../src/index.js";

describe("x402check-ai-sdk", () => {
  it("exports three tools with execute", () => {
    const tools = createX402CheckTools({
      baseUrl: "https://x402check.dev",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            url: "https://seller.example/x402",
            verdict: "ok",
            payTo: "0xabc",
            priceUsd: 0.01,
            history: { checks: 1, payToChanges: [], priceChanges: [] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    });
    assert.ok(tools.preflight_check);
    assert.ok(tools.verify_payto);
    assert.ok(tools.compare_tools);
    assert.equal(typeof tools.preflight_check.execute, "function");
  });

  it("preflight_check execute returns verdict", async () => {
    const tools = createX402CheckTools({
      baseUrl: "https://x402check.dev",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            url: "https://seller.example/x402",
            verdict: "caution",
            reasonCodes: ["new_endpoint"],
            history: { checks: 1 },
          }),
          { status: 200 },
        ),
    });
    const out = await tools.preflight_check.execute({
      url: "https://seller.example/x402",
    });
    assert.equal(out.verdict, "caution");
  });

  it("beforePayment denies avoid", async () => {
    process.env.X402CHECK_URL = "https://x402check.dev";
    const pay = beforePayment(
      async () => "paid",
      {
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              url: "https://bad.example/x402",
              verdict: "avoid",
              history: { checks: 1 },
            }),
            { status: 200 },
          ),
        allowCaution: true,
      },
    );
    // withPreflightPay uses process env / opts.baseUrl — inject via baseUrl
    const guarded = beforePayment(
      async () => "paid",
      {
        baseUrl: "https://x402check.dev",
        allowCaution: true,
      },
    );
    // override preflight by temporarily mocking global fetch
    const orig = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          url: "https://bad.example/x402",
          verdict: "avoid",
          history: { checks: 0 },
        }),
        { status: 200 },
      );
    try {
      await assert.rejects(
        () => guarded("https://bad.example/x402"),
        /preflight_deny|avoid/,
      );
    } finally {
      globalThis.fetch = orig;
    }
  });
});
