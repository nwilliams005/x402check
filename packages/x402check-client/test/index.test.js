import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  preflight,
  assertPayable,
  withPreflightPay,
  wrapFetch,
  createAxiosRequestInterceptor,
} from "../src/index.js";

const OK = {
  url: "https://seller.example/api",
  verdict: "ok",
  payTo: "0xabc",
  priceUsd: 0.01,
  history: { checks: 1, payToChanges: [], priceChanges: [] },
};

describe("x402check-client", () => {
  const prevSkip = process.env.X402CHECK_SKIP;
  const prevUrl = process.env.X402CHECK_URL;

  beforeEach(() => {
    delete process.env.X402CHECK_SKIP;
    process.env.X402CHECK_URL = "https://x402check.dev";
  });

  afterEach(() => {
    if (prevSkip === undefined) delete process.env.X402CHECK_SKIP;
    else process.env.X402CHECK_SKIP = prevSkip;
    if (prevUrl === undefined) delete process.env.X402CHECK_URL;
    else process.env.X402CHECK_URL = prevUrl;
  });

  it("preflight returns ToolCheck", async () => {
    const check = await preflight("https://seller.example/api", {
      baseUrl: "https://x402check.dev",
      fetchImpl: async () =>
        new Response(JSON.stringify(OK), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    assert.equal(check.verdict, "ok");
  });

  it("assertPayable throws on avoid", () => {
    assert.throws(
      () => assertPayable({ url: "https://bad.example", verdict: "avoid" }),
      /preflight_deny/,
    );
  });

  it("withPreflightPay denies avoid", async () => {
    const pay = withPreflightPay(async () => "paid", {
      baseUrl: "https://x402check.dev",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ url: "https://bad.example", verdict: "avoid", history: {} }),
          { status: 200 },
        ),
    });
    await assert.rejects(() => pay("https://bad.example"), /preflight_deny/);
  });

  it("wrapFetch preflights then calls through", async () => {
    const calls = [];
    const fakeFetch = async (input) => {
      calls.push(String(input));
      return new Response("ok", { status: 200 });
    };
    const wrapped = wrapFetch(fakeFetch, {
      baseUrl: "https://x402check.dev",
      fetchImpl: async (u) => {
        calls.push(`preflight:${u}`);
        return new Response(JSON.stringify(OK), { status: 200 });
      },
    });
    const res = await wrapped("https://seller.example/api");
    assert.equal(res.status, 200);
    assert.ok(calls.some((c) => c.startsWith("preflight:")));
    assert.ok(calls.includes("https://seller.example/api"));
  });

  it("wrapFetch skips x402check.dev host", async () => {
    let preflighted = false;
    const wrapped = wrapFetch(
      async () => new Response("self", { status: 200 }),
      {
        baseUrl: "https://x402check.dev",
        fetchImpl: async () => {
          preflighted = true;
          return new Response(JSON.stringify(OK), { status: 200 });
        },
      },
    );
    await wrapped("https://x402check.dev/preflight?url=https://seller.example");
    assert.equal(preflighted, false);
  });

  it("wrapFetch denies avoid before calling fetch", async () => {
    let fetched = false;
    const wrapped = wrapFetch(
      async () => {
        fetched = true;
        return new Response("nope");
      },
      {
        baseUrl: "https://x402check.dev",
        fetchImpl: async () =>
          new Response(
            JSON.stringify({ url: "https://bad.example", verdict: "avoid", history: {} }),
            { status: 200 },
          ),
      },
    );
    await assert.rejects(() => wrapped("https://bad.example/api"), /preflight_deny/);
    assert.equal(fetched, false);
  });

  it("createAxiosRequestInterceptor attaches check and blocks avoid", async () => {
    const okInterceptor = createAxiosRequestInterceptor({
      baseUrl: "https://x402check.dev",
      fetchImpl: async () =>
        new Response(JSON.stringify(OK), { status: 200 }),
    });
    const cfg = await okInterceptor({
      baseURL: "https://seller.example",
      url: "/api",
    });
    assert.equal(cfg.x402check.verdict, "ok");

    const badInterceptor = createAxiosRequestInterceptor({
      baseUrl: "https://x402check.dev",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ url: "https://seller.example/api", verdict: "avoid", history: {} }),
          { status: 200 },
        ),
    });
    await assert.rejects(
      () => badInterceptor({ url: "https://seller.example/api" }),
      /preflight_deny/,
    );
  });
});
