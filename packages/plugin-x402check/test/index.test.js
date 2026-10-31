import { describe, it } from "node:test";
import assert from "node:assert/strict";
import plugin from "../src/index.js";
import { preflightCheckAction } from "../src/actions/preflight.js";

describe("plugin-x402check", () => {
  it("exports plugin with three actions", () => {
    assert.equal(plugin.name, "plugin-x402check");
    assert.equal(plugin.actions.length, 3);
  });

  it("preflight handler returns verdict", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          url: "https://seller.example/x402",
          verdict: "ok",
          payTo: "0xabc",
          priceUsd: 0.01,
          reasonCodes: [],
          history: { checks: 1 },
        }),
        { status: 200 },
      );
    try {
      const runtime = { getSetting: () => "https://x402check.dev" };
      const result = await preflightCheckAction.handler(
        runtime,
        { content: { text: "Is https://seller.example/x402 safe?" } },
        {},
        {},
        async () => {},
      );
      assert.equal(result.success, true);
      assert.equal(result.values.verdict, "ok");
    } finally {
      globalThis.fetch = orig;
    }
  });
});
