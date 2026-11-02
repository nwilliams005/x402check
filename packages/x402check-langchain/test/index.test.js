import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createX402CheckTools, x402checkTools } from "../src/index.js";

describe("x402check-langchain", () => {
  it("creates named tools", () => {
    const tools = createX402CheckTools({ baseUrl: "https://x402check.dev" });
    assert.equal(tools.preflight_check.name, "preflight_check");
    assert.equal(tools.verify_payto.name, "verify_payto");
    assert.equal(tools.compare_tools.name, "compare_tools");
    assert.equal(x402checkTools().length, 3);
  });

  it("preflight_check invokes client", async () => {
    const tools = createX402CheckTools({
      baseUrl: "https://x402check.dev",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            url: "https://seller.example/x402",
            verdict: "ok",
            history: { checks: 2 },
          }),
          { status: 200 },
        ),
    });
    const raw = await tools.preflight_check.invoke({
      url: "https://seller.example/x402",
    });
    const parsed = JSON.parse(raw);
    assert.equal(parsed.verdict, "ok");
  });
});
