#!/usr/bin/env node
/**
 * Minimal stdio MCP bridge → remote POST /mcp or HTTP /preflight.
 * Draft for registry packaging; not a full SDK client.
 */
import { createInterface } from "node:readline";

const BASE = (process.env.X402CHECK_URL || "").replace(/\/$/, "");
if (!BASE) {
  console.error("Set X402CHECK_URL to the deployed preflight origin");
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, terminal: false });

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

rl.on("line", async (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  try {
    const res = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.X402CHECK_PAYMENT_HEADER
          ? { "PAYMENT-SIGNATURE": process.env.X402CHECK_PAYMENT_HEADER }
          : {}),
        ...(process.env.X402CHECK_BYPASS === "1"
          ? { "x-local-dev-bypass": "1" }
          : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    const data = await res.json();
    send(data);
  } catch (e) {
    send({
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code: -32000, message: String(e?.message || e) },
    });
  }
});
