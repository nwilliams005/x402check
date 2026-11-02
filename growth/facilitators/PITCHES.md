# Facilitator / docs pitches (drafts)

Rule: docs PRs may be opened if focused and useful. Cold emails stay drafts until Nicklaus sends.

---

## A. Coinbase / x402 Foundation docs (PR path) · OPENED

**Repos:** https://github.com/coinbase/x402 (docs under `docs/`)
**Best edit:** add x402check to `docs/dev-tools/third-party-extensions.md` (or third-party tools table) as a buyer-side preflight, plus a short "check live 402 before paying" note in `docs/getting-started/quickstart-for-buyers.mdx` if the PR stays small.
**Why useful without being spam:** buyers already get spend controls examples; they do not get listing-drift guidance.

**Email fallback (only if PR closed / ignored):** n/a public docs@ ; use GitHub.

See `growth/facilitators/coinbase-third-party-extensions.patch.md` for exact table row.

---

## B. PayAI · docs repo + email

**Docs repo:** https://github.com/PayAINetwork/docs (Mintlify)
**Product docs:** https://docs.payai.network/x402/facilitators/introduction
**Contributing:** https://docs.payai.network/project-info/contributing
**Contact guess from public site:** check payai.network/about ; prefer GitHub issue/PR on docs for "Buyer checklist" page.

### Docs PR idea (draft page outline, do not invent PayAI APIs)
Title: Buyer checklist before settle
Body bullets:
- Read live 402 accepts[]
- Enforce max amount
- Allowlist payTo
- Optional external preflight (link x402check.dev as community tool)

### Email draft
To: (find public contact on payai.network; else open a docs PR and skip email)
Subject: Can we add a "preflight before paying" note to PayAI x402 buyer docs?

Hi PayAI team,

Could you add a short buyer checklist to the x402 facilitator docs that tells agents to read the live 402 (and optionally preflight) before settle? Directory listings drift from live payTo and price, and it creates failed payments that look like facilitator bugs.

I run https://x402check.dev and can open a docs PR against PayAINetwork/docs if you are open to a community tools link. Want me to send the PR, or is there a preferred doc path?

Thanks,
Nicklaus Williams
https://x402check.dev

---

## C. thirdweb · portal docs

**Docs:** https://portal.thirdweb.com/x402 and https://portal.thirdweb.com/x402/server
**Code:** https://github.com/thirdweb-dev/js (SDK; docs may be separate CMS)
**Reality:** portal content is not clearly a public markdown PR. Prefer email / support + a snippet PR to examples if one exists.

### Email draft
To: support@thirdweb.com (confirm on site) or partner form
Subject: Add a preflight step to thirdweb x402 buyer examples?

Hi thirdweb team,

Can you add one step to the x402 buyer examples that checks the live 402 (payTo + amount) before verifyPayment/settlePayment? Agents that trust index listings hit stale prices and old wallets, then blame the SDK.

I maintain https://x402check.dev (buyer preflight). Happy to PR an example snippet into a public repo if you point me at the right one. Which repo should community examples go to?

Thanks,
Nicklaus Williams

---

## D. x402.org / Foundation

**Site:** https://www.x402.org / docs often mirror coinbase/x402 GitBook
**GitHub org:** x402-foundation/x402 (examples live here too)
**Action:** same class of docs PR as Coinbase repo when contents align; otherwise email via foundation contact if listed.

### Email / issue draft
Subject: Buyer guidance: live 402 before pay

Hi,

Please consider a short "before you pay" note on the buyer quickstart: treat directory metadata as hints; always read the live 402; allowlist payTo; cap spend. Happy to open a PR on coinbase/x402 or x402-foundation/x402 docs.

Nicklaus Williams
https://x402check.dev

---

## Priority
1) Open Coinbase third-party-extensions PR today  
2) PayAI docs PR or email  
3) thirdweb email  
4) Foundation note if Coinbase PR does not cover GitBook


## Opened PR

- x402 Foundation third-party utilities: https://github.com/x402-foundation/x402/pull/4108
- PayAI buyer docs (live 402 before funds): https://github.com/PayAINetwork/docs/pull/115
