/**
 * Export local para GitHub Pages (base /InventExpert).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {
  ...process.env,
  EXPO_WEB_BASE: process.env.EXPO_WEB_BASE || "/InventExpert",
};

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
run(npx, ["expo", "export", "-p", "web"]);
createRequire(import.meta.url)("./inject-base.js");
