/**
 * Pós-processo do expo export -p web para GitHub Pages.
 * Base: EXPO_WEB_BASE (default /InventExpert) — mesmo repo do app.
 */
const fs = require("fs");
const path = require("path");

const base =
  (process.env.EXPO_WEB_BASE || "/InventExpert").replace(/\/$/, "") + "/";
const file = path.join("dist", "index.html");

if (!fs.existsSync(file)) {
  console.error("[inject-base] dist/index.html não encontrado. Rode expo export -p web.");
  process.exit(1);
}

let content = fs.readFileSync(file, "utf8");
const tag = `<base href="${base}" />`;

if (!content.includes("<base ")) {
  content = content.replace(/<head[^>]*>/i, (m) => `${m}${tag}`);
  fs.writeFileSync(file, content);
  console.log(`[inject-base] injetado ${tag}`);
} else {
  console.log("[inject-base] <base> já presente — ok");
}

fs.copyFileSync(file, path.join("dist", "404.html"));
fs.writeFileSync(path.join("dist", ".nojekyll"), "");
console.log("[inject-base] 404.html + .nojekyll OK → base", base);
