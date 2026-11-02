# Daily X procedure — @x402checkdev

Run once per day (prefer morning America/Chicago). Read `strategy.md` first. **Do not post** without Nicklaus's standing "schedule/post" approval for this account. Log everything. Never put secrets in chat or in these files.

## 0. Preconditions

- [ ] Vault login **X (x402check)** available; do not paste password/OTP into repo files.
- [ ] Read `posted.log` and `queue.md` statuses.
- [ ] Check AgentKit / product changes only if needed for a fresh post (no fabricated news).

## 1. Pick the original post

1. Take the next `Status: ready` item in `queue.md` (lowest Q-id not marked posted).
2. **Or** write a fresh post if today has real material:
   - `/stats` numbers from production (only real aggregates)
   - Live $5/30d watch + /stats (real numbers only)
   - Merged directory PR, AgentKit review reply (factual)
   - Credible public x402 safety finding you can link (cite URL)
3. Weighted length check (must be ≤280, prefer ≤270):

```bash
python3 - <<'PY'
import re, sys
text = sys.stdin.read().rstrip("\n")
url_re = re.compile(r"https?://[^\s]+")
stripped = url_re.sub("\x00", text)
w = 0
for ch in stripped:
    if ch == "\x00":
        w += 23
        continue
    o = ord(ch)
    if (0x1F300 <= o <= 0x1FAFF) or (0x2600 <= o <= 0x27BF) or (0xFE00 <= o <= 0xFE0F) or (0x1F1E0 <= o <= 0x1F1FF) or o in (0x200D, 0x20E3):
        w += 2
    elif 0x1100 <= o <= 0x11FF or 0x2E80 <= o <= 0x9FFF or 0xAC00 <= o <= 0xD7AF or 0xF900 <= o <= 0xFAFF or 0xFF00 <= o <= 0xFFEF:
        w += 2
    else:
        w += 1
print(w, "OK" if w <= 280 else "OVER")
PY
```

Paste the post body on stdin. If OVER, cut words — do not drop the product URL on agent cards.

4. Ban checklist: no open-source / audit / fake usage claims; no Solana-live; disclose if naming the project as ours; ≤1 emoji.

## 2. Find up to 3 reply targets

Search (X API or UI) for recent posts matching intent, e.g.:

- `x402 (payTo OR preflight OR "spend cap" OR MCP) -is:retweet`
- Builders asking how to verify sellers before agents pay

For each candidate:

1. Confirm we have **not** already replied (scan `posted.log` for target id).
2. Confirm the thread is on-topic (strategy §4).
3. Draft ≤280 weighted chars; leading reply @handles are free; still disclose ownership when pitching.
4. Cap **3 replies total** today. Zero is fine.

## 3. Publish

1. Post the original in the 08:00–11:00 CT window when possible.
2. Post replies spaced ≥20 minutes apart; do not dump all at once.
3. Do not pin over the launch thread unless Nicklaus asks.

## 4. Log and mark queue

Append to `posted.log`:

```
YYYY-MM-DDTHH:MM:SS-06:00 | original|reply | Qxx|target_handle/id | https://x.com/x402checkdev/status/... | notes
```

In `queue.md`, change that item's `Status: ready` → `posted` and add the URL under it.

## 5. Duplicate / rate limits

- Never resend identical body text.
- If X rejects as duplicate, rewrite ≥30% of wording and re-check length.
- If the account hits "Unlock more on X" / human verification, **stop** and escalate to Nicklaus — do not automate CAPTCHA bypass beyond the normal vault sign-in flow.
- Soft stop: 1 original + 3 replies. Hard stop: anything that feels spammy.

## 6. Weekly hygiene (Fridays)

- Skim `posted.log` for dead ends (0 impressions after 48h is normal early; do not spam harder).
- Refill `queue.md` to keep ≥7 ready posts.
- Re-run a light research pass on `@AIonBase_`, safety-lane accounts, and `x402` volume peaks; update `strategy.md` citations only with real post URLs.


## Package versions (keep posts accurate)

- x402check-mcp@0.1.3 · x402check-client@0.1.2 · x402check-langchain@0.1.1 (npm + PyPI) · x402check-ai-sdk@0.1.1 · plugin-x402check@0.1.2
- MCP Registry: dev.x402check/mcp@0.1.3
- Do not invent usage; pull https://x402check.dev/stats when citing numbers.
