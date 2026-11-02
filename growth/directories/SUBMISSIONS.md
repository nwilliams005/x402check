# Directory / marketplace submissions

Prepared Nov 2, 2026 (America/Chicago). Browser-only steps are listed separately. API/GitHub-doable items noted.

Shared facts for forms:
- Name: x402check
- Tagline: Check before paying any x402 API
- URL: https://x402check.dev
- MCP URL: https://x402check.dev/mcp
- Docs: https://x402check.dev/docs
- Privacy: https://x402check.dev/privacy
- Terms: https://x402check.dev/terms
- Support: nicklauswilliams25@gmail.com
- GitHub: https://github.com/nwilliams005/x402check
- npm MCP: x402check-mcp
- Registry: dev.x402check/mcp
- Logo: https://x402check.dev/assets/icon.svg
- Author: Nicklaus Williams
- Pricing note: 1 free regular check/wallet; then $0.01; deep $0.05; watch $5/30d; USDC Exact on Base

---

## 1. Cursor Directory (community) · BROWSER
**Path:** https://cursor.directory/plugins/new
**Also:** official curated form https://cursor.com/marketplace/publish (separate, slower)
**Requirements:** Sign in with GitHub. Public repo. Prefer `.mcp.json` at repo root (Open Plugins). Auto scan → safe/suspicious/malicious.
**Prepared `.mcp.json` (add to nwilliams005/x402check root before submit):**

```json
{
  "mcpServers": {
    "x402check": {
      "command": "npx",
      "args": ["-y", "x402check-mcp"]
    }
  }
}
```

**Manual fields if needed:**
- Name: x402check
- Description: Preflight x402 seller URLs before your agent pays (ok/caution/avoid + history). USDC on Base.
- Repo: https://github.com/nwilliams005/x402check
- Homepage: https://x402check.dev
- Keywords: x402, mcp, preflight, agents, usdc, base

**Status:** Browser login required. Do not submit until Nicklaus is at the form (or approves a desktop session).

---

## 2. Anthropic Claude Connectors / Plugins · BROWSER
**Path:** https://claude.ai/directory/manage → Submit new → MCP connector (and optionally Plugin bundle)
**Docs:** https://claude.com/docs/connectors/building/submission · https://claude.com/docs/directory/publish
**Requirements:** Paid Claude plan. Remote HTTPS MCP. Every tool has title + readOnlyHint or destructiveHint. Docs + privacy URLs. Icon. Reviewer test account notes. Confirm you tested as custom connector.
**Prepared values:**
- Server URL: https://x402check.dev/mcp
- Documentation URL: https://x402check.dev/docs
- Privacy policy URL: https://x402check.dev/privacy
- Support: nicklauswilliams25@gmail.com
- Icon: https://x402check.dev/assets/icon.svg
- Short description: Check an x402 endpoint before your agent pays it. Returns ok, caution, or avoid plus history.
- Auth: none for public preflight tools (payment via x402 on tool call)
- Test prompts for reviewers:
  1. "Use preflight_check on https://www.api-xpay.com/x402/ping and summarize the verdict."
  2. "Call verify_payto for the same URL and show payTo."
  3. Negative: "Call preflight_check without a url" (expect schema error)
- Reviewer note: unpaid tools/call returns x402 PaymentRequired; one free regular check per wallet via free challenge flow documented at /docs

**Status:** Browser + Claude login. Not submitted.

---

## 3. OpenAI Plugins / Apps directory · BROWSER
**Path:** OpenAI Platform → Plugins → Upload plugin · docs https://developers.openai.com/plugins/deploy/submission
**Requirements:** Org identity verification. ZIP package (skills and/or MCP). Domain verification for remote MCP. 5 positive + 3 negative test cases for remote MCP. Demo recording. Policy attestations. Permissions api.apps.write.
**Prepared listing fields:**
- Package / display name: x402check
- Short description (≤30 chars): Check before paying x402
- Long description: AI agents call x402check before settling USDC on Base to an x402 seller. Live 402 + history → ok|caution|avoid. One free regular check per wallet; then $0.01; deep $0.05; watch $5/30 days. Not OFAC or legal scam adjudication.
- Developer name: Nicklaus Williams
- Category: Developer tools
- Website / support / privacy / terms: https://x402check.dev · mailto:nicklauswilliams25@gmail.com · /privacy · /terms
- MCP Server URL: https://x402check.dev/mcp
- Starter prompts:
  1. Check this x402 URL before I pay it
  2. Verify payTo on a seller URL
  3. Compare two x402 tools

**Status:** Browser + OpenAI org verification. Not submitted. ZIP packaging still needed.

---

## 4. Gemini CLI Extensions gallery · GITHUB (API-doable)
**Path:** No submit form. Public repo + topic `gemini-cli-extension` + root `gemini-extension.json`. Crawled daily. Docs: https://geminicli.com/docs/extensions/releasing/
**Prepared `gemini-extension.json`:** see repo root after commit.
**Install for users:** `gemini extensions install https://github.com/nwilliams005/x402check`
**Status:** DONE. `gemini-extension.json` on mainline branch; topic `gemini-cli-extension` present on https://github.com/nwilliams005/x402check

---

## 5. Grok Bot / xAI plugin form · BROWSER
**Path:** https://x.ai/bot/marketplace/submit-a-plugin
**Fields:**
- Organization handle: x402check
- Website: https://x402check.dev
- Logotype: https://x402check.dev/assets/icon.svg
- MCP Server URL or Public GitHub Repository: https://x402check.dev/mcp
- List on: Grok Bot, Cursor, (Grok coming soon)
- Brief description (≤600): x402check preflights x402 seller URLs before an agent pays. Live 402 and history return ok, caution, or avoid so you can deny bad payTo, price drift, or dead routes. One free regular check per wallet; then $0.01 USDC on Base. Docs at https://x402check.dev/docs
- Testing instructions (≤600): Add MCP URL https://x402check.dev/mcp. Call preflight_check with url https://www.api-xpay.com/x402/ping. Expect a ToolCheck JSON with verdict. Unpaid calls may return x402 PaymentRequired; complete Exact USDC on Base or use the free-check challenge in the docs. Confirm privacy https://x402check.dev/privacy
- Checkbox: tested locally/in-app

**Status:** Browser. Not submitted.

---

## 6. Grok Build plugin marketplace · GITHUB PR (approved to open)
**Path:** Fork https://github.com/xai-org/plugin-marketplace · add entry to `.grok-plugin/marketplace.json` · pin full commit SHA · run `python3 scripts/generate-plugin-index.py` · open PR
**Prepared catalog sketch:**

```json
{
  "name": "x402check",
  "description": "Preflight x402 seller URLs before paying (ok/caution/avoid).",
  "homepage": "https://x402check.dev",
  "category": "developer-tools",
  "keywords": ["x402check", "x402 preflight", "x402check.dev"],
  "domains": ["x402check.dev"],
  "source": {
    "type": "remote",
    "url": "https://github.com/nwilliams005/x402check",
    "sha": "<FULL_SHA>"
  }
}
```

**Risk:** CONTRIBUTING prefers official org over personal account for branded plugins. May be questioned under nwilliams005. Still valid to try.
**Status:** Attempt PR after `.mcp.json` + plugin manifest land on main SHA.

---

## Already done earlier (do not redo)
- GitHub Marketplace Action: https://github.com/marketplace/actions/x402check-endpoint-preflight
- Glama: https://glama.ai/mcp/connectors/dev.x402check/mcp
- x402scan: registered
- MCP Registry: dev.x402check/mcp (waiting period)
- Smithery: publishing shut down Oct 31, 2026
- mcp.so: paid listing, skipped


## Gemini CLI extensions gallery (updated)

No form and no PR. Listing is automatic:

1. Public GitHub repo with `gemini-extension.json` at the repository root (added in this branch).
2. Add GitHub topic `gemini-cli-extension` on the repo About section (API: `gh repo edit OWNER/REPO --add-topic gemini-cli-extension`).
3. Gallery crawler indexes tagged repos daily.

Install command for users: `gemini extensions install https://github.com/nwilliams005/x402-preflight`

Note: geminicli.com docs (May 2026) say Gemini CLI was replaced by Antigravity CLI for unpaid/Google One tiers on June 18, 2026; the topic-based gallery crawl still applies to the extension ecosystem described there.

## x402-foundation docs PR (done)

Opened: https://github.com/x402-foundation/x402/pull/4108 (third-party utilities table).
