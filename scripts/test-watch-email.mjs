#!/usr/bin/env node
import { spawnSync } from "node:child_process";
const r = spawnSync("npx", ["--yes", "tsx", "scripts/test-watch-email.mts"], {
  cwd: new URL("..", import.meta.url).pathname,
  encoding: "utf8",
  stdio: "inherit",
  env: process.env,
});
process.exit(r.status ?? 1);
