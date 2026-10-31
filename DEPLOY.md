# Deploy — x402check.dev

Production Worker `x402check` on zone `x402check.dev` (CF account `3d713278ffd837b2b46e92d76e30ed24`).

**Do not deploy without Nicklaus's explicit approval.**

```bash
cd /workspace/x402-preflight
export WRANGLER_CACHE_DIR=/tmp/wcache
export CLOUDFLARE_ACCOUNT_ID=3d713278ffd837b2b46e92d76e30ed24
# CLOUDFLARE_API_TOKEN must already be in env (never print). CDP secrets already on the Worker.
npx wrangler deploy --config wrangler.toml
```

After deploy, run the IndexNow + Google sitemap pings in `DISCOVERY.md` (account-free).

Local testnet: `npm run test:local` (wrangler.dev.toml).
