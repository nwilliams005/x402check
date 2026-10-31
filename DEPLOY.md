# Deploy — x402check.dev

Production Worker `x402check` on zone `x402check.dev` (CF account `3d713278ffd837b2b46e92d76e30ed24`).

```bash
cd /workspace/x402-preflight
export WRANGLER_CACHE_DIR=/tmp/wcache
export CLOUDFLARE_ACCOUNT_ID=3d713278ffd837b2b46e92d76e30ed24
# CLOUDFLARE_API_TOKEN, CDP_API_KEY_ID, CDP_API_KEY_SECRET in env
npx wrangler kv namespace create PAYTO_HISTORY   # paste id into wrangler.toml
printf '%s' "$CDP_API_KEY_ID" | npx wrangler secret put CDP_API_KEY_ID
printf '%s' "$CDP_API_KEY_SECRET" | npx wrangler secret put CDP_API_KEY_SECRET
npx wrangler deploy
```

Local testnet: `npm run test:local` (wrangler.dev.toml).
