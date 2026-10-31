/**
 * Build an x402 HTTPFacilitatorClient for either:
 * - public testnet facilitator (no auth), or
 * - Coinbase CDP mainnet facilitator (JWT via CDP_API_KEY_ID / CDP_API_KEY_SECRET).
 *
 * Keys are never hardcoded: Worker secrets (c.env) first, then process.env.
 * Mirrors @coinbase/cdp-sdk createCdpFacilitatorClient without pulling broken SVM peers.
 */
import { HTTPFacilitatorClient } from "@x402/core/server";
import { generateJwt } from "@coinbase/cdp-sdk/auth";

export const CDP_FACILITATOR_URL =
  "https://api.cdp.coinbase.com/platform/v2/x402";
export const TESTNET_FACILITATOR_URL = "https://x402.org/facilitator";

function readProcessEnv(name: string): string | undefined {
  try {
    // Workers secrets bind to c.env; Node / wrangler may also expose process.env.
    const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
    return g.process?.env?.[name];
  } catch {
    return undefined;
  }
}

function resolveCreds(env?: {
  CDP_API_KEY_ID?: string;
  CDP_API_KEY_SECRET?: string;
}): { apiKeyId: string; apiKeySecret: string } {
  const apiKeyId = env?.CDP_API_KEY_ID || readProcessEnv("CDP_API_KEY_ID");
  const apiKeySecret =
    env?.CDP_API_KEY_SECRET || readProcessEnv("CDP_API_KEY_SECRET");
  const missing: string[] = [];
  if (!apiKeyId) missing.push("CDP_API_KEY_ID");
  if (!apiKeySecret) missing.push("CDP_API_KEY_SECRET");
  if (missing.length) {
    throw new Error(
      `Missing required CDP credentials: ${missing.join(", ")}. ` +
        "Set Worker secrets (wrangler secret put) or process.env.",
    );
  }
  return { apiKeyId: apiKeyId!, apiKeySecret: apiKeySecret! };
}

function isCdpFacilitator(url: string): boolean {
  try {
    const host = new URL(url).host.toLowerCase();
    return host === "api.cdp.coinbase.com" || host.endsWith(".cdp.coinbase.com");
  } catch {
    return false;
  }
}

export function createFacilitatorClient(
  facilitatorUrl: string,
  env?: { CDP_API_KEY_ID?: string; CDP_API_KEY_SECRET?: string },
): HTTPFacilitatorClient {
  const url = facilitatorUrl || TESTNET_FACILITATOR_URL;

  if (!isCdpFacilitator(url)) {
    return new HTTPFacilitatorClient({ url });
  }

  const credentials = resolveCreds(env);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid facilitator URL: ${url}`);
  }
  const basePath = parsed.pathname.replace(/\/$/, "");
  const host = parsed.host;
  const paths = {
    verify: `${basePath}/verify`,
    settle: `${basePath}/settle`,
    supported: `${basePath}/supported`,
  };

  return new HTTPFacilitatorClient({
    url,
    createAuthHeaders: async () => {
      const mk = async (path: string, method: "GET" | "POST") => {
        const jwt = await generateJwt({
          apiKeyId: credentials.apiKeyId,
          apiKeySecret: credentials.apiKeySecret,
          requestMethod: method,
          requestHost: host,
          requestPath: path,
        });
        return {
          Authorization: `Bearer ${jwt}`,
          "Correlation-Context": "sdkLanguage=typescript,source=x402check",
        };
      };
      const [verify, settle, supported] = await Promise.all([
        mk(paths.verify, "POST"),
        mk(paths.settle, "POST"),
        mk(paths.supported, "GET"),
      ]);
      return { verify, settle, supported };
    },
  });
}
