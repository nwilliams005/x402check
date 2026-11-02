import {
  preflightCheckAction,
  verifyPaytoAction,
  compareToolsAction,
} from "./actions/preflight.js";

/**
 * ElizaOS plugin: x402check preflight before paying an x402 endpoint.
 * https://x402check.dev
 */
export const x402checkPlugin = {
  name: "plugin-x402check",
  description:
    "Preflight x402 seller endpoints (ok|caution|avoid + history) before an agent pays. $0.002 Exact USDC on Base via x402check.dev",
  actions: [preflightCheckAction, verifyPaytoAction, compareToolsAction],
  providers: [],
  evaluators: [],
  services: [],
  init: async (_config, _runtime) => {
    if (!process.env.X402CHECK_URL) {
      process.env.X402CHECK_URL = "https://x402check.dev";
    }
  },
};

export default x402checkPlugin;
