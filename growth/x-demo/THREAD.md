# X demo thread draft for @x402checkdev (DO NOT POST until approved)

Tone: human, specific, no hype stats we cannot prove. Anonymize owners. America/Chicago dates.

## Suggested media
1. Screenshot A: side by side of a directory card showing a tiny price vs a live 402 JSON with a much larger amount (blur host if needed, or use synthetic redacted panels).
2. Screenshot B: x402check ToolCheck JSON with verdict caution/avoid, priceUsd, payTo, reasonCodes (redact full URL path if it identifies the owner).
3. Optional 15-25s screen recording: hit listed URL → see 402 → run preflight on x402check.dev → show mismatch. No voiceover required; burn-in captions.

Recording plan: browser only, no other owners' PII, crop out emails. Prefer recreating with a public demo seller or redacted DevTools panels so we never leak private scan KV.

---

## Post 1 / 5
agents keep paying x402 tools from directory prices.

today I compared public listings to live 402s. same failure modes over and over: stale price, old payTo, routes that 404 while still listed.

thread on what broke and what to do before you sign ↓

## Post 2 / 5
pattern 1: listed near free, live not.

one upload-style route was listed around $0.005. live 402 asked ~$2 to the same wallet.

any agent that budgeted from the index underpaid and never got the bytes.

## Post 3 / 5
pattern 2: price matched, wallet did not.

GPU / marketplace rows still pointed payTo at an old address. live 402 already used a new one.

if your agent trusts the listing, USDC goes somewhere the seller may not watch.

## Post 4 / 5
pattern 3: the row outlives the route.

indexes still showing paths that return 404 or 410 retired. agents retry ghosts.

fixings for sellers: delete dead rows, refresh payTo on rotation, mark model quotes as variable.

## Post 5 / 5
buyer habit that actually helps:

1. read the live 402
2. allowlist payTo when you can
3. cap spend at signing time
4. optional: preflight on x402check.dev ($0.01, 1 free/wallet)

I am not posting the owner names. if you run a seller and want a free recheck after you fix a listing, reply and I will.

docs: https://x402check.dev/blog/five-x402-listing-mistakes

---

## Alt shorter closer (if 5 feels long)
drop post 4 into post 3, end on the buyer habit + blog link.
