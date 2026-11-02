/**
 * Public /scan explain page + owner dashboard HTML.
 * No ecosystem numbers, no per-endpoint public data.
 */
import { headTagsFragment, siteFooter, siteNav } from "./pages";

export function scanExplainHtml(origin: string, pricePerTool: number): string {
  const description =
    "Verify you own an x402 endpoint, see your private scan snapshot, and opt in to a Verified by x402check badge. Live agent checks stay paid.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
${headTagsFragment({
  origin,
  title: "Owner verify & badge · x402check",
  description,
  path: "/scan",
  omitMarkdown: true,
})}
  <style>
    .steps{counter-reset:step;margin:1.5rem 0}
    .steps li{list-style:none;position:relative;padding:.85rem 0 .85rem 2.5rem;border-bottom:1px solid #1a2433;color:#c5d4e5}
    .steps li:before{counter-increment:step;content:counter(step);position:absolute;left:0;top:.85rem;width:1.6rem;height:1.6rem;border-radius:999px;background:#121a24;border:1px solid #243246;color:#7dd3a7;font-size:.8rem;font-weight:700;display:flex;align-items:center;justify-content:center}
    .panel{background:#0e1520;border:1px solid #1e2a3a;border-radius:12px;padding:1.1rem 1.2rem;margin:1.25rem 0}
    .panel h3{margin:.1rem 0 .5rem;font-size:1rem}
    .panel p,.panel li{color:#9fb3c8;font-size:.92rem}
    .warn{color:#e6c07b;font-size:.88rem}
  </style>
</head>
<body>
  <div class="bg"></div>
  ${siteNav("/scan")}
  <main class="wrap docs">
    <p class="eyebrow">Owners · not a public directory</p>
    <h1>Verify ownership.<br/><span style="color:#7dd3a7">See your snapshot. Optional badge.</span></h1>
    <p class="lede">
      x402check runs an <strong>internal</strong> periodic scanner. Results are
      <strong>not</strong> a public dataset, directory, or free substitute for paid checks.
      If you operate an x402 endpoint, you can prove ownership and view
      <em>only your</em> stored snapshot. Agents that need a live trust check still pay
      <strong>$${pricePerTool}</strong> via <code>GET /preflight</code>.
    </p>

    <div class="cta-row">
      <a class="btn primary" href="/docs">Run a paid check</a>
      <a class="btn" style="background:#121a24;color:#e8eef7;border:1px solid #243246" href="/owner">Owner dashboard</a>
      <code class="chip">GET ${origin}/preflight?url=…</code>
    </div>

    <h2>How owner verification works</h2>
    <ol class="steps">
      <li>Start a challenge for your endpoint URL.</li>
      <li><strong>Primary:</strong> sign the challenge with the endpoint’s <code>payTo</code> wallet (EIP-191 personal_sign; ERC-1271 smart wallets supported).</li>
      <li><strong>Fallback:</strong> publish a short-lived token as a DNS TXT <code>x402check-verify=…</code> or at <code>/.well-known/x402check-verify.txt</code> on your domain.</li>
      <li>Your session can read snapshots for endpoints you verified · nothing else.</li>
    </ol>

    <div class="panel">
      <h3>What you see after verifying</h3>
      <ul>
        <li>Your endpoint’s latest <strong>periodic snapshot</strong> grade (pass / warn / fail) and timestamp.</li>
        <li>Clear labeling that a snapshot is <em>not</em> a live paid preflight.</li>
        <li>Upsells: $5 / 30-day watch, and paid <code>/preflight</code> for live verification.</li>
        <li>Optional <strong>Verified by x402check</strong> badge (opt-in, revocable, unguessable id).</li>
      </ul>
      <p class="warn">We do not publish ecosystem tallies, per-endpoint public pages, or a public JSON export of scan results.</p>
    </div>

    <div class="panel">
      <h3>Badge rules</h3>
      <p>
        Badges are issued only to verified owners who opt in. The image URL uses a random id
        (not your endpoint URL). It shows a simple pass mark and last-verified date when your
        latest snapshot is <strong>pass</strong>. Unknown, revoked, or non-pass badges return nothing useful.
      </p>
    </div>

    <h2>API sketch</h2>
    <pre>POST /owner/challenge   {"url":"https://yours.example/x402"}
POST /owner/verify      {"challengeId":"…","signature":"0x…"}
POST /owner/verify-dns  {"challengeId":"…","method":"dns"|"wellknown"}
GET  /owner/dashboard   Authorization: Bearer &lt;session&gt;
POST /owner/badge       {"url":"…"}   // opt in
DELETE /owner/badge     {"url":"…"}   // revoke
GET  /badge/&lt;id&gt;.svg    // public image if active + pass</pre>

    <p class="fine">
      Agents: skip this page · use <a href="/docs">paid preflight</a>,
      <a href="/llms.txt">llms.txt</a>, or <a href="/openapi.json">OpenAPI</a>.
      One free regular check per wallet is documented there (not a scan substitute).
    </p>
  </main>
  ${siteFooter().trim()}
</body>
</html>`;
}

export function ownerDashboardHtml(origin: string, pricePerTool: number): string {
  const description =
    "Owner dashboard for x402check: verify payTo or DNS, view your private scan snapshot, manage your badge.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
${headTagsFragment({
  origin,
  title: "Owner dashboard · x402check",
  description,
  path: "/owner",
  omitMarkdown: true,
})}
  <style>
    .row{display:flex;flex-wrap:wrap;gap:.6rem;margin:.75rem 0 1rem}
    input,select,button,textarea{font:inherit}
    input[type=text],textarea{flex:1;min-width:220px;background:#0e1520;border:1px solid #1e2a3a;color:#e8eef7;border-radius:8px;padding:.55rem .7rem}
    button{background:#7dd3a7;color:#062016;border:0;border-radius:999px;padding:.55rem 1rem;font-weight:700;cursor:pointer}
    button.secondary{background:#121a24;color:#e8eef7;border:1px solid #243246}
    button.danger{background:#3a1820;color:#f0b0b8;border:1px solid #5a2830}
    #out{white-space:pre-wrap;background:#0e1520;border:1px solid #1e2a3a;border-radius:8px;padding:1rem;color:#c5d4e5;font-family:ui-monospace,Menlo,monospace;font-size:.82rem;min-height:4rem}
    .hint{color:#7a8ea3;font-size:.85rem}
    .card-ep{background:#0e1520;border:1px solid #1e2a3a;border-radius:12px;padding:1rem;margin:.75rem 0}
    .grade-pass{color:#7dd3a7}.grade-warn{color:#e6c07b}.grade-fail{color:#f0a0a8}.grade-unknown{color:#7a8ea3}
  </style>
</head>
<body>
  <div class="bg"></div>
  ${siteNav("/owner")}
  <main class="wrap docs">
    <h1>Owner dashboard</h1>
    <p class="lede">
      Prove you control an endpoint, then view <strong>only that endpoint’s</strong> periodic snapshot.
      Snapshots are not live paid checks · agents should still call
      <code>GET /preflight</code> ($${pricePerTool}).
    </p>

    <section class="card-ep">
      <h3>1. Start challenge</h3>
      <div class="row">
        <input id="url" type="text" placeholder="https://yours.example/x402" />
        <button id="btnChal" type="button">Challenge</button>
      </div>
      <p class="hint">Primary: sign as payTo. Fallback: DNS TXT or /.well-known/x402check-verify.txt</p>
    </section>

    <section class="card-ep">
      <h3>2a. Verify with payTo signature</h3>
      <div class="row">
        <input id="sig" type="text" placeholder="0x signature" />
        <button id="btnVerify" type="button">Verify signature</button>
      </div>
      <p class="hint">Sign the message from the challenge (EIP-191). Smart wallets: ERC-1271.</p>
    </section>

    <section class="card-ep">
      <h3>2b. Verify with DNS / well-known</h3>
      <div class="row">
        <select id="dnsMethod">
          <option value="wellknown">well-known file</option>
          <option value="dns">DNS TXT</option>
        </select>
        <button id="btnDns" type="button" class="secondary">Check fallback</button>
      </div>
    </section>

    <section class="card-ep">
      <h3>3. Dashboard</h3>
      <div class="row">
        <button id="btnDash" type="button" class="secondary">Refresh dashboard</button>
        <button id="btnBadgeOn" type="button">Opt in badge</button>
        <button id="btnBadgeOff" type="button" class="danger">Revoke badge</button>
      </div>
      <div id="eps"></div>
    </section>

    <h3>Raw</h3>
    <pre id="out">Ready.</pre>
  </main>
  ${siteFooter().trim()}
  <script>
  (function(){
    const out = document.getElementById('out');
    const eps = document.getElementById('eps');
    let challenge = null;
    function token(){ return localStorage.getItem('x402check_owner') || ''; }
    function setToken(t){ if(t) localStorage.setItem('x402check_owner', t); }
    function show(x){ out.textContent = typeof x === 'string' ? x : JSON.stringify(x, null, 2); }
    async function api(path, opts){
      const headers = Object.assign({'content-type':'application/json'}, (opts && opts.headers) || {});
      const t = token();
      if (t) headers['authorization'] = 'Bearer ' + t;
      const r = await fetch(path, Object.assign({}, opts, { headers }));
      const text = await r.text();
      let j; try { j = JSON.parse(text); } catch { j = { raw: text, status: r.status }; }
      if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), { payload: j, status: r.status });
      return j;
    }
    function renderDash(data){
      eps.innerHTML = '';
      (data.endpoints || []).forEach(function(ep){
        const g = (ep.snapshot && ep.snapshot.grade) || 'unknown';
        const div = document.createElement('div');
        div.className = 'card-ep';
        div.innerHTML = '<strong>'+ep.url+'</strong>'
          + '<div class="grade-'+g+'">snapshot: '+g+(ep.snapshot.gradedAt ? ' · '+ep.snapshot.gradedAt : '')+'</div>'
          + '<p class="hint">'+((ep.snapshot && ep.snapshot.note) || '')+'</p>'
          + (ep.badge && ep.badge.embedUrl ? '<p>badge: <code>'+ep.badge.embedUrl+'</code></p>' : '<p class="hint">badge off</p>')
          + '<p class="hint">'+ep.upsells.watch+'</p>'
          + '<p class="hint">'+ep.upsells.paidCheck+'</p>';
        eps.appendChild(div);
      });
    }
    document.getElementById('btnChal').onclick = async function(){
      try {
        const url = document.getElementById('url').value.trim();
        challenge = await api('/owner/challenge', { method:'POST', body: JSON.stringify({ url }) });
        show(challenge);
      } catch(e){ show(e.payload || String(e)); }
    };
    document.getElementById('btnVerify').onclick = async function(){
      try {
        const signature = document.getElementById('sig').value.trim();
        const j = await api('/owner/verify', { method:'POST', body: JSON.stringify({
          challengeId: challenge && challenge.challengeId,
          signature
        })});
        setToken(j.sessionToken);
        show(j);
      } catch(e){ show(e.payload || String(e)); }
    };
    document.getElementById('btnDns').onclick = async function(){
      try {
        const method = document.getElementById('dnsMethod').value;
        const j = await api('/owner/verify-dns', { method:'POST', body: JSON.stringify({
          challengeId: challenge && challenge.challengeId,
          method
        })});
        setToken(j.sessionToken);
        show(j);
      } catch(e){ show(e.payload || String(e)); }
    };
    document.getElementById('btnDash').onclick = async function(){
      try {
        const j = await api('/owner/dashboard');
        show(j); renderDash(j);
      } catch(e){ show(e.payload || String(e)); }
    };
    document.getElementById('btnBadgeOn').onclick = async function(){
      try {
        const url = document.getElementById('url').value.trim();
        const j = await api('/owner/badge', { method:'POST', body: JSON.stringify({ url }) });
        show(j);
      } catch(e){ show(e.payload || String(e)); }
    };
    document.getElementById('btnBadgeOff').onclick = async function(){
      try {
        const url = document.getElementById('url').value.trim();
        const j = await api('/owner/badge', { method:'DELETE', body: JSON.stringify({ url }) });
        show(j);
      } catch(e){ show(e.payload || String(e)); }
    };
  })();
  </script>
</body>
</html>`;
}
