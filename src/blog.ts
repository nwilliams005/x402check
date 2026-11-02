/**
 * Blog pages for x402check.dev · HTML + markdown twins + Article JSON-LD.
 * Posts are static; do not invent stats in new posts.
 */
import { headTagsFragment, siteFooter } from "./pages";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  tags: string[];
  /** Markdown body without the H1 title */
  body: string;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-to-check-x402-before-paying",
    title: "How to check an x402 endpoint before your agent pays",
    description: "A practical preflight flow for AI agents that pay x402 APIs with USDC on Base: live 402, payTo, price, and what to do with ok, caution, and avoid.",
    date: "2026-11-02",
    tags: ["x402", "agents", "preflight", "USDC", "Base"],
    body: `Your agent finds a paid tool. The server returns HTTP 402 with an amount, a payTo wallet, a network, and an asset. The next step is usually "sign and retry." That is also the step that burns money if the listing was wrong, the wallet rotated, or the route is dead.

Here is a simple preflight habit that keeps the signing step boring.

## What you are checking

You are not asking a blacklist whether a wallet is "evil." You are asking the seller URL what it demands **right now**, and whether that matches what you expected.

Useful signals:

- Does the URL answer with a real 402?
- What is the live \`payTo\`?
- What is the live price in USDC?
- Has \`payTo\` or price changed since the last time you saw this URL?
- Is the endpoint reachable at all?

x402check returns those as a compact \`ok\` / \`caution\` / \`avoid\` verdict plus history for that URL only.

## The policy that actually works

| Verdict | What your agent should do |
| --- | --- |
| \`avoid\` | Do not pay. Pick another tool or stop. |
| \`caution\` | Escalate. Ask a human, tighten the budget, or probe again. |
| \`ok\` | You may proceed, but still enforce your own max amount and allowlist. |

\`ok\` is not a blessing. It means the live 402 looks consistent with what we know. Your spend caps still matter.

## Three ways to call it

**HTTP**

\`\`\`bash
curl "https://x402check.dev/preflight?url=https%3A%2F%2Fseller.example%2Ftool"
\`\`\`

Unauthenticated calls return 402 from x402check itself. One free regular check per wallet is available through \`/preflight/free*\`. After that, a regular check is **$0.01** Exact USDC on Base. A deep check is **$0.05**. Watching a URL for 30 days is **$5**.

**MCP**

Point your client at \`https://x402check.dev/mcp\` (or run the \`x402check-mcp\` stdio package) and call \`preflight_check\` with the seller URL.

**npm**

\`\`\`bash
npm install x402check-client
\`\`\`

\`\`\`ts
import { preflight, wrapFetch } from "x402check-client";

const check = await preflight("https://seller.example/tool");
if (check.verdict === "avoid") throw new Error(check.reasonCodes?.join(",") ?? "avoid");

// Or wrap fetch so every x402 settle is checked first:
const fetchWithCheck = wrapFetch(globalThis.fetch, { onAvoid: "throw" });
\`\`\`

## Where listings go wrong

Public directories (Bazaar, 402 Index, and friends) cache a price and a wallet. Sellers change either without refreshing the listing. Agents that budget from the directory underpay, overpay, or send funds to an old address. A live 402 read catches that in one round trip.

## What this is not

x402check is not OFAC screening, not a drainer simulator, and not a legal "this is a scam" stamp. It is endpoint and history signal before you sign.

If you operate sellers yourself, pair this with the [GitHub Action](https://github.com/marketplace/actions/x402check-endpoint-preflight) so your own listings cannot drift unnoticed.`,
  },
  {
    slug: "five-x402-listing-mistakes",
    title: "5 x402 listing mistakes that cost agents money",
    description: "Anonymized patterns from real Bazaar and 402 Index listings that disagree with live 402 quotes: stale prices, old wallets, retired routes, and dynamic pricing.",
    date: "2026-11-02",
    tags: ["x402", "Bazaar", "listings", "agents"],
    body: `On November 2, 2026 (America/Chicago) I compared public x402 directory listings to live 402 responses and emailed or messaged owners when they disagreed. I am not naming those owners here. The patterns repeat, and they are exactly what burns agent budgets.

Below are five mistakes that showed up more than once. Counts are from that outreach pass, not a claim about the whole ecosystem.

## 1. Listed price far below the live quote

One upload style endpoint was listed around half a cent. The live 402 asked for about **$2** to the same wallet. Agents that sized a budget from the directory underpaid every time and never got the resource.

**Fix for sellers:** push discovery metadata whenever your quote table changes, or mark the listing as tiered / dynamic.

**Fix for buyers:** always read the live 402 (or run a preflight) before you sign. Treat directory prices as hints.

## 2. Stale payTo while the price looks fine

Several GPU and marketplace routes kept the listed amount but pointed \`payTo\` at an old wallet. Live 402s already used a new address. Price matched. Destination did not.

Agents that trust the listing can send USDC to a wallet the seller no longer monitors.

**Fix:** refresh Bazaar / index rows when you rotate settlement wallets. Buyers should compare live \`payTo\` to an allowlist.

## 3. Directory still shows a retired or 404 route

More than one project left routes on 402 Index after the path returned **404** or **410** ("endpoint retired"). Listings still advertised a price.

Agents waste a check, a signature attempt, or worse, keep retrying.

**Fix:** delete or replace dead rows. Point \`llms.txt\` and indexes at the URLs you actually serve.

## 4. Snapshot prices for model dependent quotes

Gateways that quote per model correctly return a live 402 that depends on the model id. Directories still showed a single fixed number from an old snapshot. Live quotes ranged from roughly the snapshot up to several times higher depending on the model.

The product works. The cached number lies.

**Fix:** publish a preferred probe model, or label the listing as price varies. Buyers should never settle from the snapshot alone.

## 5. Auth mismatch: index says x402, live asks for something else

At least one indexed "x402" route returned **401** with a SIWE style challenge instead of a 402 payment requirement, while a sibling route charged a tiny Exact amount that did not match the index's dollar price.

Agents that only speak x402 see a broken endpoint. Agents that trust the index price will misbudget the route that does speak 402.

**Fix:** either expose a clean 402 on the listed URL, or remove the row and document the real auth flow.

## How often did this show up?

In that Nov 2 outreach pass I contacted **10** endpoint owners across Bazaar and 402 Index after live probes disagreed with the listing. Pattern mix among those 10:

- Price mismatch: several (including one ~400x gap)
- Stale payTo: at least two product lines
- 404 / 410 listed routes: at least two
- Dynamic vs snapshot pricing: at least one
- Auth / index confusion: at least one

That is not "X% of all x402 is broken." It is "these failure modes are real and easy to hit."

## What agents should do anyway

1. Prefer live 402 over directory metadata.
2. Deny on unreachable / not a 402 when you expected payment.
3. Allowlist \`payTo\` when you can.
4. Cap spend per call and per day.
5. Optional: call [x402check](https://x402check.dev) before \`PAYMENT-SIGNATURE\` ($0.01 regular, one free check per wallet).

If you own a listing and want a free recheck after you fix it, use the free check on the site or reply to the note I sent.`,
  },
  {
    slug: "x402check-github-action-ci",
    title: "Using x402check in CI with the GitHub Action",
    description: "Fail or warn your builds when an x402 seller's price, payTo, or network drifts. Setup for the x402check Endpoint Preflight Action.",
    date: "2026-11-02",
    tags: ["x402", "CI", "GitHub Actions", "sellers"],
    body: `If you sell through x402, silent drift is the boring kind of outage. Your live 402 starts asking for a new price or a new \`payTo\`, the directory still shows the old numbers, and agents fail or pay the wrong wallet until someone notices.

The [x402check Endpoint Preflight](https://github.com/marketplace/actions/x402check-endpoint-preflight) GitHub Action runs the same checks in CI on a schedule or on push.

## What it does

For each URL you list, it calls x402check and compares:

- \`priceUsd\`
- \`payTo\`
- \`network\`

…to either explicit expected values or a baseline file from the last good run. Mode \`fail\` breaks the job. Mode \`warn\` only annotates.

## Minimal workflow

\`\`\`yaml
name: x402 seller preflight
on:
  schedule:
    - cron: "0 */6 * * *"
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: nwilliams005/x402check-action@v1
        with:
          mode: fail
          payer-private-key: \${{ secrets.X402CHECK_PAYER_KEY }}
          endpoints: |
            [
              {
                "url": "https://your.example/api/tool",
                "expectedPriceUsd": 0.01,
                "expectedPayTo": "0xYourPayTo",
                "expectedNetwork": "eip155:8453"
              }
            ]
\`\`\`

Store the payer key as \`X402CHECK_PAYER_KEY\`. Fund it with a little USDC on Base. The Action will try the **one free regular check per wallet** first, then pay **$0.01** (or **$0.05** if you set \`deep: true\`).

## Baseline mode

If you omit \`expected*\`, the Action compares to \`.x402check-baseline.json\` and can rewrite it after a clean run (\`write-baseline: true\`). That is handy when prices are intentional but you still want to catch surprise changes.

## Pair with watch

CI catches drift when GitHub runs. For email when price or \`payTo\` changes between runs, use the **$5 / 30 day** watch on [x402check.dev](https://x402check.dev/docs).

## Pinning

Marketplace listing: [x402check Endpoint Preflight](https://github.com/marketplace/actions/x402check-endpoint-preflight). Pin \`@v1\` or a commit SHA. Source: [nwilliams005/x402check-action](https://github.com/nwilliams005/x402check-action).`,
  },
  {
    slug: "auto-preflight-with-wrapfetch",
    title: "One line that checks every x402 payment before it goes through",
    description: "How wrapFetch on x402check-client adds a check before paying so agents and apps do not settle blind.",
    date: "2026-11-02",
    tags: ["x402", "npm", "agents", "wrapFetch"],
    body: `Most agent stacks already wrap \`fetch\` to attach a payment signature when they see HTTP 402. The missing line is "ask whether this seller looks sane before we sign."

\`x402check-client\` 0.1.5 adds that as an opt in wrapper.

## Install

\`\`\`bash
npm install x402check-client
\`\`\`

## wrapFetch

\`\`\`ts
import { wrapFetch } from "x402check-client";

const fetchPaid = wrapFetch(globalThis.fetch, {
  onAvoid: "throw",      // or "return-check"
  onCaution: "allow",    // or "throw" / "return-check"
  maxAmountUsd: 0.05,    // optional extra guard on the seller's live price
});

// Use fetchPaid anywhere your agent used to call fetch for x402 sellers.
const res = await fetchPaid("https://seller.example/tool");
\`\`\`

On an \`avoid\` verdict the wrapper refuses to continue into payment. On \`ok\` it still lets your existing x402 payment wrapper do the Exact USDC settle on Base.

## Axios

\`\`\`ts
import axios from "axios";
import { createAxiosRequestInterceptor } from "x402check-client";

axios.interceptors.request.use(createAxiosRequestInterceptor({ onAvoid: "throw" }));
\`\`\`

## MCP and AGENTS.md

If your agent reads project instructions, drop in [AGENTS.md](https://x402check.dev/AGENTS.md) or the skill at \`/.well-known/agent-skills/x402-preflight/SKILL.md\`. The rule is the same: preflight before paying.

Remote MCP: \`https://x402check.dev/mcp\`  
Registry: \`dev.x402check/mcp\`

## Cost

- 1 free regular check ever per wallet
- then $0.01 per URL on Base USDC Exact
- optional deep check $0.05
- optional watch $5 / 30 days

No fabricated uptime claims, no public dump of other people's endpoints. You get the verdict and history for the URL you asked about.`,
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function blogSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}

/** Extremely small markdown → HTML for our posts (headings, lists, tables, code, links, bold, italic). */
export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let tableBuf: string[] = [];

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  const flushTable = () => {
    if (!inTable) return;
    const rows = tableBuf.filter((r) => !/^\s*\|?[\s:-]+\|/.test(r));
    if (rows.length) {
      out.push('<table>');
      rows.forEach((row, idx) => {
        const cells = row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());
        const tag = idx === 0 ? "th" : "td";
        out.push(
          "<tr>" +
            cells.map((c) => `<${tag}>${inlineFormat(c)}</${tag}>`).join("") +
            "</tr>",
        );
      });
      out.push("</table>");
    }
    tableBuf = [];
    inTable = false;
  };

  const inlineFormat = (s: string): string => {
    let t = escapeHtml(s);
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    t = t.replace(
      /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2" rel="noopener">$1</a>',
    );
    return t;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flushTable();
      closeLists();
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeBuf = [];
      } else {
        out.push(
          `<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeBuf.join("\n"))}</code></pre>`,
        );
        inCode = false;
        codeBuf = [];
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }
    if (line.trim().startsWith("|")) {
      closeLists();
      inTable = true;
      tableBuf.push(line);
      i++;
      continue;
    } else if (inTable) {
      flushTable();
    }
    if (/^###\s+/.test(line)) {
      closeLists();
      out.push(`<h3>${inlineFormat(line.replace(/^###\s+/, ""))}</h3>`);
    } else if (/^##\s+/.test(line)) {
      closeLists();
      out.push(`<h2>${inlineFormat(line.replace(/^##\s+/, ""))}</h2>`);
    } else if (/^#\s+/.test(line)) {
      closeLists();
      out.push(`<h1>${inlineFormat(line.replace(/^#\s+/, ""))}</h1>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inlineFormat(line.replace(/^[-*]\s+/, ""))}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inlineFormat(line.replace(/^\d+\.\s+/, ""))}</li>`);
    } else if (/^---+$/.test(line.trim())) {
      closeLists();
      out.push("<hr />");
    } else if (line.trim() === "") {
      closeLists();
    } else {
      closeLists();
      out.push(`<p>${inlineFormat(line)}</p>`);
    }
    i++;
  }
  flushTable();
  closeLists();
  if (inCode) {
    out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
  }
  return out.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function articleJsonLd(origin: string, post: BlogPost) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Person",
      name: "Nicklaus Williams",
      url: "https://x.com/x402checkdev",
    },
    publisher: {
      "@type": "Organization",
      name: "x402check",
      url: origin,
      logo: { "@type": "ImageObject", url: `${origin}/assets/icon.svg` },
    },
    mainEntityOfPage: `${origin}/blog/${post.slug}`,
    keywords: post.tags.join(", "),
  };
}

function blogNav(current = "/blog"): string {
  const link = (href: string, label: string) => {
    const cur = current === href || (href !== "/blog" && current.startsWith(href))
      ? ' aria-current="page"'
      : "";
    return `<a href="${href}"${cur}>${label}</a>`;
  };
  return `  <header class="wrap nav">
    <a class="brand" href="/">x402check</a>
    <nav>
      ${link("/docs", "Docs")}
      ${link("/blog", "Blog")}
      ${link("/scan", "Scan")}
      ${link("/owner", "Owner")}
      ${link("/stats", "Stats")}
      <a href="/openapi.json">OpenAPI</a>
      <a href="/llms.txt">llms.txt</a>
      <a href="/mcp.json">MCP</a>
    </nav>
  </header>`;
}

export function blogIndexHtml(origin: string): string {
  const cards = BLOG_POSTS.map(
    (p) => `      <article class="card">
        <p class="eyebrow">${p.date}</p>
        <h2 style="font-size:1.15rem;margin:.2rem 0 .5rem"><a href="/blog/${p.slug}" style="color:#e8eef7;text-decoration:none">${escapeHtml(p.title)}</a></h2>
        <p>${escapeHtml(p.description)}</p>
        <p class="fine"><a href="/blog/${p.slug}">Read</a> · <a href="/blog/${p.slug}.md">Markdown</a></p>
      </article>`,
  ).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
${headTagsFragment({
    origin,
    title: "Blog · x402check",
    description:
      "How-to posts on checking x402 endpoints before agents pay, listing pitfalls, CI with the GitHub Action, and auto-preflight wrappers.",
    path: "/blog",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "x402check blog",
      url: `${origin}/blog`,
      publisher: { "@type": "Organization", name: "x402check", url: origin },
      blogPost: BLOG_POSTS.map((p) => ({
        "@type": "BlogPosting",
        headline: p.title,
        url: `${origin}/blog/${p.slug}`,
        datePublished: p.date,
      })),
    },
  })}
</head>
<body>
  <div class="bg"></div>
${blogNav("/blog")}
  <main class="wrap docs">
    <p class="eyebrow">Blog</p>
    <h1>Notes for agents and sellers</h1>
    <p class="lede">Practical posts on check before paying, listing drift, and CI. Written by Nicklaus Williams. Canonical URLs live here; cross posts on Medium / dev.to should point back.</p>
    <section class="grid" style="grid-template-columns:1fr">
${cards}
    </section>
  </main>
  ${siteFooter().trim()}
</body>
</html>`;
}

export function blogPostHtml(origin: string, post: BlogPost): string {
  const path = `/blog/${post.slug}`;
  const bodyHtml = renderMarkdown(post.body);
  return `<!DOCTYPE html>
<html lang="en">
<head>
${headTagsFragment({
    origin,
    title: `${post.title} · x402check`,
    description: post.description,
    path,
    jsonLd: articleJsonLd(origin, post),
  })}
</head>
<body>
  <div class="bg"></div>
${blogNav(path)}
  <main class="wrap docs legal">
    <p class="eyebrow"><a href="/blog" style="color:#7dd3a7;text-decoration:none">Blog</a> · ${post.date}</p>
    <h1>${escapeHtml(post.title)}</h1>
    <p class="meta">By Nicklaus Williams · <a href="${path}.md">Markdown twin</a></p>
    <article class="blog-body">
${bodyHtml}
    </article>
    <p class="fine" style="margin-top:2rem">More: <a href="/blog">all posts</a> · <a href="/docs">docs</a> · <a href="/">x402check.dev</a></p>
  </main>
  ${siteFooter().trim()}
</body>
</html>`;
}

export function blogPostMarkdown(post: BlogPost): string {
  return `# ${post.title}

By Nicklaus Williams · ${post.date}
Canonical: https://x402check.dev/blog/${post.slug}

${post.body.trim()}
`;
}

export function blogIndexMarkdown(): string {
  const items = BLOG_POSTS.map(
    (p) => `- [${p.title}](https://x402check.dev/blog/${p.slug}) (${p.date}) · ${p.description}`,
  ).join("\n");
  return `# x402check blog

${items}
`;
}

