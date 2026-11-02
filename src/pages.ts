import type { StatsSnapshot } from "./stats";
import { formatOnChainLine, formatStatsLine } from "./stats";

export const styleCss = `*{box-sizing:border-box}body{margin:0;font:16px/1.5 ui-sans-serif,system-ui;color:#e8eef7;background:#070b12}
.bg{position:fixed;inset:0;background:radial-gradient(800px 400px at 20% -10%,#1a3a5c55,transparent),radial-gradient(600px 300px at 90% 10%,#0d4f3c33,transparent);pointer-events:none;z-index:-1}
.wrap{max-width:920px;margin:0 auto;padding:0 1.25rem}.nav{display:flex;justify-content:space-between;align-items:center;padding:1.25rem 1.25rem 0}
.brand{font-weight:700;color:#fff;text-decoration:none;letter-spacing:.02em}nav a{color:#9fb3c8;margin-left:1rem;text-decoration:none}
.hero{padding:3rem 1.25rem 4rem}h1{font-size:clamp(1.8rem,4vw,2.6rem);line-height:1.15;margin:0 0 1rem}
h1 span{color:#7dd3a7}.lede{color:#9fb3c8;max-width:38rem}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.72rem;color:#7dd3a7}
.cta-row{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;margin:1.5rem 0 2rem}
.btn{display:inline-block;padding:.65rem 1rem;border-radius:999px;text-decoration:none;font-weight:600}
.btn.primary{background:#7dd3a7;color:#062016}.chip{background:#121a24;border:1px solid #243246;padding:.5rem .75rem;border-radius:8px;font-size:.85rem;color:#c5d4e5}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin:2rem 0}
.card{background:#0e1520;border:1px solid #1e2a3a;border-radius:12px;padding:1rem}.card h3{margin:.2rem 0 .4rem;font-size:1rem}
.card p{margin:0;color:#9fb3c8;font-size:.9rem}.fine{color:#7a8ea3;font-size:.85rem}.foot{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;padding:2rem 1.25rem;border-top:1px solid #1a2433;color:#7a8ea3;font-size:.85rem}
.foot a{color:#7dd3a7}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}pre{background:#0e1520;border:1px solid #1e2a3a;padding:1rem;border-radius:8px;overflow:auto}
.docs{padding:2rem 1.25rem 4rem}h2{margin-top:2rem}.faq details{background:#0e1520;border:1px solid #1e2a3a;border-radius:10px;padding:.75rem 1rem;margin:.6rem 0}
.faq summary{cursor:pointer;font-weight:600}.faq p{color:#9fb3c8;margin:.5rem 0 0}
.stats-card{margin:1.5rem 0 0}.stats-card .kicker{text-transform:uppercase;letter-spacing:.12em;font-size:.72rem;color:#7dd3a7;margin:0 0 .4rem}
.stats-line{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9rem;color:#c5d4e5;margin:0}
.tiny{font-size:.78rem;margin:.45rem 0 0}.muted{color:#7a8ea3}.stats-card a{color:#7dd3a7}
.legal{padding:2rem 1.25rem 4rem}.legal h1{font-size:clamp(1.6rem,3vw,2rem);margin:0 0 .75rem}
.legal h2{font-size:1.15rem;margin:1.75rem 0 .6rem}.legal h3{font-size:1rem;margin:1.1rem 0 .4rem}
.legal p,.legal li{color:#c5d4e5}.legal ul{padding-left:1.2rem}.legal .meta{color:#7a8ea3;font-size:.9rem}
.legal pre{white-space:pre-wrap}.legal table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.9rem}
.legal th,.legal td{border:1px solid #1e2a3a;padding:.5rem .6rem;text-align:left;vertical-align:top}
.legal th{background:#0e1520;color:#9fb3c8}.foot nav a{margin-left:.75rem}`;

export function headTagsFragment(opts: {
  origin: string;
  title: string;
  description: string;
  path: string;
  jsonLd?: object;
  omitMarkdown?: boolean;
}): string {
  const canonical = `${opts.origin}${opts.path}`;
  const mdPath = opts.path === "/" ? "/index.md" : `${opts.path}.md`;
  const mdLink = opts.omitMarkdown
    ? ""
    : `\n  <link rel="alternate" type="text/markdown" href="${opts.origin}${mdPath}" />`;
  const jsonLd = opts.jsonLd
    ? `\n  <script type="application/ld+json">${JSON.stringify(opts.jsonLd)}</script>`
    : "";
  return `  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${opts.title}</title>
  <meta name="description" content="${opts.description}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="icon" href="/assets/icon.svg" type="image/svg+xml" />${mdLink}
  <link rel="describedby" href="${opts.origin}/llms.txt" />
  <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="x402check" />
  <meta property="og:title" content="${opts.title}" />
  <meta property="og:description" content="${opts.description}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${opts.origin}/assets/icon.svg" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:site" content="@x402checkdev" />
  <meta name="twitter:title" content="${opts.title}" />
  <meta name="twitter:description" content="${opts.description}" />
  <meta name="keywords" content="x402, x402check, check before paying, is this API a scam, is this x402 endpoint safe, verify payTo, agent trust, preflight, USDC, Base, MCP, AI agent tools, uptime, price drift, budget guard, compare x402 tools" />
  <link rel="stylesheet" href="/assets/style.css" />${jsonLd}`;
}

export function siteNav(currentPath = ""): string {
  const link = (href: string, label: string) => {
    const cur = currentPath === href ? ' aria-current="page"' : "";
    return `<a href="${href}"${cur}>${label}</a>`;
  };
  return `  <header class="wrap nav">
    <a class="brand" href="/">x402check</a>
    <nav>
      ${link("/docs", "Docs")}
      ${link("/stats", "Stats")}
      <a href="/openapi.json">OpenAPI</a>
      <a href="/llms.txt">llms.txt</a>
      <a href="/mcp.json">MCP</a>
    </nav>
  </header>`;
}

export function siteFooter(): string {
  return `  <footer class="wrap foot">
    <span>x402 Exact · USDC · Base · agents first</span>
    <nav>
      <a href="/terms">Terms</a>
      <a href="/privacy">Privacy</a>
      <a href="/cookies">Cookies</a>
      <a href="/docs">Docs</a>
    </nav>
  </footer>`;
}

function softwareJsonLd(origin: string, pricePerTool: number) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#org`,
        name: "x402check",
        url: origin,
        sameAs: ["https://x.com/x402checkdev", "https://github.com/nwilliams005/x402check"],
        logo: `${origin}/assets/icon.svg`,
      },
      {
        "@type": "WebAPI",
        name: "x402check",
        description:
          "Check before paying any x402 API. Paid per-tool trust preflight for AI agents: is this API a scam/legit, verify payTo, detect price/wallet drift, check uptime, compare sellers, budget guard.",
        url: origin,
        documentation: `${origin}/docs`,
        termsOfService: `${origin}/terms`,
        provider: { "@id": `${origin}/#org` },
        offers: {
          "@type": "Offer",
          price: String(pricePerTool),
          priceCurrency: "USD",
          description: "Per tool checked via x402 Exact USDC on Base",
        },
      },
      {
        "@type": "SoftwareApplication",
        name: "x402check",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any",
        url: origin,
        description:
          "x402 trust preflight for AI agents — check before paying. Endpoint live 402 + history (not wallet OFAC/simulation).",
        offers: {
          "@type": "Offer",
          price: String(pricePerTool),
          priceCurrency: "USD",
        },
        author: { "@id": `${origin}/#org` },
      },
      {
        "@type": "HowTo",
        name: "Check an x402 API before paying",
        description:
          "How an AI agent or developer checks whether an x402 seller URL is safe to pay before signing USDC on Base.",
        step: [
          {
            "@type": "HowToStep",
            name: "Call preflight",
            text: `GET ${origin}/preflight?url=SELLER_URL (or MCP preflight_check). Pay $${pricePerTool} USDC Exact on Base.`,
          },
          {
            "@type": "HowToStep",
            name: "Read the verdict",
            text: "avoid → do not pay. caution → escalate. ok → still enforce your maxAmount and allowlist.",
          },
          {
            "@type": "HowToStep",
            name: "Verify payTo and drift",
            text: "Confirm ToolCheck.payTo, and inspect history.payToChanges / history.priceChanges before signing.",
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Is this x402 endpoint safe?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `Call GET ${origin}/preflight?url=SELLER (pay $${pricePerTool} USDC). verdict=avoid means do not pay; caution means escalate; ok still requires your maxAmount check. Endpoint+history signals — not a legal scam ruling.`,
            },
          },
          {
            "@type": "Question",
            name: "Is this API a scam?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `x402check does not issue a legal scam label. It checks the seller URL's live 402 challenge and history (reachability, payTo, price, drift). Use GET ${origin}/preflight?url=… before paying; deny on avoid. Live honest counts: ${origin}/stats.`,
            },
          },
          {
            "@type": "Question",
            name: "How do I check before paying an x402 tool?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `Always call GET ${origin}/preflight?url=SELLER (or MCP preflight_check / npm x402check-client) before PAYMENT-SIGNATURE. Deny on avoid; escalate on caution; still enforce maxAmount on ok.`,
            },
          },
          {
            "@type": "Question",
            name: "How do I verify payTo on an x402 tool?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "ToolCheck.payTo is the address from the seller's live 402 challenge. history.payToChanges shows wallet rotations. Use before signing USDC on Base.",
            },
          },
          {
            "@type": "Question",
            name: "How do I detect a rug or price hike?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Inspect history.payToChanges and history.priceChanges. Sudden new payTo or large price jumps are signals to deny or escalate before paying.",
            },
          },
          {
            "@type": "Question",
            name: "Is this x402 endpoint down?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "ToolCheck reports live status, latencyMs, and history.uptimePct / lastFailAt for that seller URL.",
            },
          },
          {
            "@type": "Question",
            name: "How do I compare several x402 tools?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `POST ${origin}/preflight with urls[] (or MCP compare_tools). Charged $${pricePerTool} × N in one Exact settlement. Compare verdict, priceUsd, uptime, and drift.`,
            },
          },
          {
            "@type": "Question",
            name: "How much does x402check cost?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `$${pricePerTool} USDC Exact per tool on Base (eip155:8453). Batch = N × unit in one settlement. Optional deep check is $0.05. Optional watch is $5 Exact / 30 days. No free tier. Live usage: ${origin}/stats.`,
            },
          },
        ],
      },
    ],
  };
}

export function landingHtml(
  origin: string,
  pricePerTool: number,
  stats?: StatsSnapshot | null,
): string {
  const statsLine = stats ? formatStatsLine(stats) : "";
  const onChainLine =
    stats?.onChain != null ? formatOnChainLine(stats.onChain) : "";
  const noteBits = [
    stats?.noteDetail || null,
    onChainLine || null,
    "Real counts only — never padded",
  ].filter(Boolean);
  const statsBlock = stats
    ? `<section class="card stats-card" aria-label="Live usage stats">
      <div class="kicker">Live stats</div>
      <p class="stats-line">${statsLine}</p>
      ${onChainLine ? `<p class="stats-line">${onChainLine}</p>` : ""}
      <p class="muted tiny">${noteBits.join(" · ")} · <a href="/stats">JSON /stats</a> · optional <a href="/docs">$5/30d watch</a></p>
    </section>`
    : "";
  const description =
    "Check before paying any x402 API. Agents get a compact ok|caution|avoid verdict + history. Is this API a scam / endpoint safe? Verify payTo, detect price drift, check uptime, compare sellers, budget guard.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
${headTagsFragment({
  origin,
  title: "x402check — check before paying any x402 API (AI agent trust preflight)",
  description,
  path: "/",
  jsonLd: softwareJsonLd(origin, pricePerTool),
})}
</head>
<body>
  <div class="bg"></div>
  <header class="wrap nav">
    <a class="brand" href="/">x402check</a>
    <nav>
      <a href="/docs">Docs</a>
      <a href="/stats">Stats</a>
      <a href="/openapi.json">OpenAPI</a>
      <a href="/llms.txt">llms.txt</a>
      <a href="/mcp.json">MCP</a>
    </nav>
  </header>
  <main class="wrap hero">
    <p class="eyebrow">No free tier · $${pricePerTool} / tool · deep $0.05 · watch $5/30d</p>
    <h1>Trust-check a tool<br/><span>before your agent pays it.</span></h1>
    <p class="lede">
      Every check is paid. You get that tool’s <strong>verdict</strong> plus its
      <strong>history</strong> (uptime, payTo changes, price changes) — nothing else.
      Cache-fresh responses target &lt;300&nbsp;ms. Built for agents that need to
      <em>check before paying</em>, ask <em>is this API a scam</em> /
      <em>is this x402 endpoint safe</em>, <em>verify payTo</em>, detect drift, compare sellers,
      or keep a budget guard before signing USDC on Base.
    </p>
    ${statsBlock}
    <div class="cta-row">
      <a class="btn primary" href="/docs">Docs for agents</a>
      <code class="chip">GET ${origin}/preflight?url=…</code>
    </div>
    <section class="grid">
      <article class="card"><h3>Check before paying</h3><p>Call preflight before any PAYMENT-SIGNATURE. avoid → deny. caution → escalate. ok → still enforce maxAmount.</p></article>
      <article class="card"><h3>Scam / rug signals</h3><p>Live 402 + history: payTo swaps, price hikes, uptime. Not a legal scam ruling — endpoint signals agents can act on.</p></article>
      <article class="card"><h3>Compact JSON</h3><p>Stable fields: verdict, payTo, priceUsd, reasonCodes, history for that URL only.</p></article>
      <article class="card"><h3>Discoverable</h3><p>OpenAPI, llms.txt, MCP (preflight + verify_payto + compare_tools + watch_tool), A2A, Bazaar. Live counts at /stats.</p></article>
    </section>
    <section class="faq">
      <h2>Questions agents ask</h2>
      <details open>
        <summary>Is this x402 endpoint safe?</summary>
        <p>Call <code>GET /preflight?url=…</code>. <strong>avoid</strong> → do not pay. <strong>caution</strong> → escalate. <strong>ok</strong> → still enforce your maxAmount. Endpoint+history signals, not a legal scam ruling.</p>
      </details>
      <details open>
        <summary>Is this API a scam?</summary>
        <p>We do not issue a legal “scam” label. We check the seller URL’s live 402 and history (reachability, payTo, price, drift) so agents can refuse shady pays. Deny on <strong>avoid</strong>. Honest usage: <a href="/stats">/stats</a>.</p>
      </details>
      <details>
        <summary>How do I check before paying?</summary>
        <p>Always call <code>GET /preflight?url=…</code> (or MCP <code>preflight_check</code> / npm <code>x402check-client</code>) before <code>PAYMENT-SIGNATURE</code>. Policy: avoid→deny, caution→confirm, ok→still enforce maxAmount.</p>
      </details>
      <details>
        <summary>How do I verify payTo before signing?</summary>
        <p>Read <code>payTo</code> from the ToolCheck. Compare to your allowlist. <code>history.payToChanges</code> shows prior wallets if the seller rotated. MCP tool: <code>verify_payto</code>.</p>
      </details>
      <details>
        <summary>Price hike, rug, or wallet swap?</summary>
        <p>Inspect <code>history.priceChanges</code> and <code>history.payToChanges</code> before you settle.</p>
      </details>
      <details>
        <summary>Is the endpoint down? Which tool is best?</summary>
        <p>Use uptime fields on a single check, or <code>POST /preflight</code> / MCP <code>compare_tools</code> to rank candidates by verdict, price, and stability.</p>
      </details>
      <details>
        <summary>How do I pay for a check?</summary>
        <p>Unauthenticated calls return HTTP 402. Decode <code>PAYMENT-REQUIRED</code>, sign Exact USDC on Base (see body.accepts[] / PAYMENT-REQUIRED), retry with <code>PAYMENT-SIGNATURE</code>. See <a href="/openapi.json">OpenAPI</a>.</p>
      </details>
      <details>
        <summary>Can I watch a seller over time?</summary>
        <p>Optional: <code>POST /watch</code> with <code>{url, webhookUrl?, email?}</code> — $5 Exact USDC buys 30 days of daily re-checks. Webhook and/or email on payTo, price, network, or availability change. Status: <code>GET /watch?id=…</code>.</p>
      </details>
    </section>
    <p class="fine">We never pay the target. Agents-first brand. Markdown twin: <a href="/index.md">/index.md</a>.</p>
  </main>
  ${siteFooter().trim()}
</body>
</html>`;
}

export function docsHtml(origin: string, pricePerTool: number): string {
  const description =
    "Agent docs for x402check: check before paying any x402 API, is this API a scam/safe, verify payTo, uptime, compare tools, budget guard, OpenAPI and MCP discovery.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
${headTagsFragment({
  origin,
  title: "Docs — x402check agent trust preflight",
  description,
  path: "/docs",
  jsonLd: softwareJsonLd(origin, pricePerTool),
})}
</head>
<body>
  <div class="bg"></div>
  <header class="wrap nav">
    <a class="brand" href="/">x402check</a>
    <nav>
      <a href="/docs" aria-current="page">Docs</a>
      <a href="/stats">Stats</a>
      <a href="/openapi.json">OpenAPI</a>
      <a href="/llms.txt">llms.txt</a>
      <a href="/mcp.json">MCP</a>
    </nav>
  </header>
  <main class="wrap docs">
    <h1>Agent docs</h1>
    <p class="lede">Paid per tool. No free checks. Base unit <strong>$${pricePerTool}</strong>. Optional <strong>deep check $0.05</strong> (multi-probe + listings + recent on-chain sample). Optional <strong>watch $5 / 30 days</strong>. Use before any x402 settle when you need to <em>check before paying</em>, ask <em>is this API a scam</em> / <em>is this x402 endpoint safe</em>, <em>verify payTo</em>, check uptime, compare sellers, or keep a budget guard.</p>
    <h2>Single</h2>
    <pre>GET ${origin}/preflight?url=https%3A%2F%2Fwww.api-xpay.com%2Fx402%2Fping</pre>
    <h2>Deep check ($0.05)</h2>
    <p>Optional. <code>GET /preflight/deep?url=…</code> or MCP <code>deep_check</code>. Same base signals, plus repeated probes, a recent public Base USDC-to-payTo sample, Bazaar/402 Index listing checks, and drift vs last KV history. Honest limits: not OFAC, not wallet simulation, not full chain history.</p>
    <h2>Batch (N × $${pricePerTool} in one Exact payment)</h2>
    <pre>POST ${origin}/preflight
{"urls":["https://a.example/x402","https://b.example/x402"]}</pre>
    <p>Limitation: x402 Exact = <em>one</em> settlement per HTTP request. Batch uses DynamicPrice = N×unit, not N separate txs.</p>
    <h2>When to call</h2>
    <ul>
      <li>Check before paying / before PAYMENT-SIGNATURE to any third-party x402 settle</li>
      <li>Is this API a scam / is this x402 endpoint safe or legit?</li>
      <li>Verify payTo; detect payTo or price changes</li>
      <li>Uptime / is the endpoint down</li>
      <li>Compare candidates; screen Bazaar search hits</li>
      <li>Validate 402 requirements; debug failing settles</li>
      <li>Audit log of why you paid or refused · live counts at <a href="/stats">/stats</a></li>
    </ul>
    <h2>Adopt by default</h2>
    <ul>
      <li>Client wrapper that calls preflight before any x402 pay (<code>x402check-client</code>).</li>
      <li>Runtime skill/middleware default-on with env kill-switch.</li>
      <li>Policy: avoid→deny, caution→confirm, ok→still enforce maxAmount.</li>
      <li>MCP tools: <code>preflight_check</code>, <code>verify_payto</code>, <code>preflight_batch</code>, <code>compare_tools</code>. Unpaid <code>tools/call</code> returns x402 <code>PaymentRequired</code>; pay via <code>_meta['x402/payment']</code>.</li>
      <li>Keep p95 &lt;300ms via cache so agents don’t skip.</li>
    </ul>
    <h2>Integrations</h2>
    <ul>
      <li><a href="https://www.npmjs.com/package/x402check-ai-sdk"><code>x402check-ai-sdk</code></a> — Vercel AI SDK tools + <code>beforePayment</code></li>
      <li><a href="https://www.npmjs.com/package/x402check-langchain"><code>x402check-langchain</code></a> — LangChain JS tools</li>
      <li><a href="https://www.npmjs.com/package/plugin-x402check"><code>plugin-x402check</code></a> — ElizaOS plugin</li>
      <li><a href="https://pypi.org/project/x402check-langchain/"><code>x402check-langchain</code></a> — LangChain Python tools (PyPI)</li>
      <li><a href="https://github.com/nwilliams005/x402check-cloudflare-agent">Cloudflare Agents template</a></li>
      <li><a href="https://github.com/nwilliams005/x402check-examples">OpenAI Agents / LlamaIndex / CrewAI examples</a></li>
      <li>MCP Registry: <code>dev.x402check/mcp</code> · remote <code>https://x402check.dev/mcp</code></li>
    </ul>
    <h2>Machine-readable</h2>
    <p>
      <a href="/openapi.json">openapi.json</a> ·
      <a href="/llms.txt">llms.txt</a> ·
      <a href="/llms-full.txt">llms-full.txt</a> ·
      <a href="/mcp.json">mcp.json</a> ·
      <a href="/mcp/server-card">mcp/server-card</a> ·
      <a href="/.well-known/ai-catalog.json">ai-catalog</a> ·
      <a href="/docs.md">docs.md</a>
    </p>
  </main>
  ${siteFooter().trim()}
</body>
</html>`;
}
