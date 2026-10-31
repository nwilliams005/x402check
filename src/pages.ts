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
.docs{padding:2rem 1.25rem 4rem}h2{margin-top:2rem}`;

export function landingHtml(origin: string, pricePerTool: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>x402check — pay-per-tool trust check</title>
  <meta name="description" content="Agents pay per tool checked. Compact verdict + history before any x402 payment." />
  <link rel="stylesheet" href="/assets/style.css" />
</head>
<body>
  <div class="bg"></div>
  <header class="wrap nav">
    <a class="brand" href="/">x402check</a>
    <nav>
      <a href="/docs">Docs</a>
      <a href="/openapi.json">OpenAPI</a>
      <a href="/llms.txt">llms.txt</a>
      <a href="/mcp.json">MCP</a>
    </nav>
  </header>
  <main class="wrap hero">
    <p class="eyebrow">No free tier · $${pricePerTool} / tool · batch = N×unit</p>
    <h1>Trust-check a tool<br/><span>before your agent pays it.</span></h1>
    <p class="lede">
      Every check is paid. You get that tool’s <strong>verdict</strong> plus its
      <strong>history</strong> (uptime, payTo changes, price changes) — nothing else.
      Cache-fresh responses target &lt;300&nbsp;ms.
    </p>
    <div class="cta-row">
      <a class="btn primary" href="/docs">Docs for agents</a>
      <code class="chip">GET ${origin}/preflight?url=…</code>
    </div>
    <section class="grid">
      <article class="card"><h3>Per-tool Exact</h3><p>DynamicPrice scales with batch size. One settlement per HTTP request.</p></article>
      <article class="card"><h3>Compact JSON</h3><p>Stable fields: verdict, payTo, priceUsd, reasonCodes, history.</p></article>
      <article class="card"><h3>History that matters</h3><p>Past checks, uptime %, payTo drift, price moves — for that URL only.</p></article>
      <article class="card"><h3>Discoverable</h3><p>OpenAPI, llms.txt, MCP descriptor, Bazaar discovery extension.</p></article>
    </section>
    <p class="fine">Not tied to contractor brands. Prefer a dedicated agent domain (see brand research). We never pay the target.</p>
  </main>
  <footer class="wrap foot">
    <span>x402 Exact · USDC · agents first</span>
    <a href="/docs">Integration →</a>
  </footer>
</body>
</html>`;
}

export function docsHtml(origin: string, pricePerTool: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Docs — x402check</title>
  <link rel="stylesheet" href="/assets/style.css" />
</head>
<body>
  <div class="bg"></div>
  <header class="wrap nav">
    <a class="brand" href="/">x402check</a>
    <nav>
      <a href="/docs" aria-current="page">Docs</a>
      <a href="/openapi.json">OpenAPI</a>
      <a href="/llms.txt">llms.txt</a>
      <a href="/mcp.json">MCP</a>
    </nav>
  </header>
  <main class="wrap docs">
    <h1>Agent docs</h1>
    <p class="lede">Paid per tool. No free checks. Recommended unit <strong>$${pricePerTool}</strong> (Bazaar micro-utils often $0.001–$0.005).</p>
    <h2>Single</h2>
    <pre>GET ${origin}/preflight?url=https%3A%2F%2Fwww.api-xpay.com%2Fx402%2Fping</pre>
    <h2>Batch (N × $${pricePerTool} in one Exact payment)</h2>
    <pre>POST ${origin}/preflight
{"urls":["https://a.example/x402","https://b.example/x402"]}</pre>
    <p>Limitation: x402 Exact = <em>one</em> settlement per HTTP request. Batch uses DynamicPrice = N×unit, not N separate txs.</p>
    <h2>Adopt by default</h2>
    <ul>
      <li>Client wrapper that calls preflight before any x402 pay.</li>
      <li>Runtime skill/middleware default-on with env kill-switch.</li>
      <li>Policy: avoid→deny, caution→confirm, ok→still enforce maxAmount.</li>
      <li>Bazaar listing + OpenAPI + MCP descriptor (shipped).</li>
      <li>Keep p95 &lt;300ms via cache so agents don’t skip.</li>
    </ul>
    <h2>Machine-readable</h2>
    <p><a href="/openapi.json">openapi.json</a> · <a href="/llms.txt">llms.txt</a> · <a href="/mcp.json">mcp.json</a></p>
  </main>
</body>
</html>`;
}
