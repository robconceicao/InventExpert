/**
 * Garante <base href="..."> no dist/index.html após expo export -p web.
 * Preferir EXPO_WEB_BASE=/inventexpert-web (experiments.baseUrl no app.config.js).
 * Fallback: injeta base se o export não tiver colocado.
 */
const fs = require("fs");
const path = require("path");

const base =
  (process.env.EXPO_WEB_BASE || "/inventexpert-web").replace(/\/$/, "") + "/";
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

// SPA: 404.html = index (GitHub Pages)
fs.copyFileSync(file, path.join("dist", "404.html"));
// Desativa Jekyll no GH Pages
fs.writeFileSync(path.join("dist", ".nojekyll"), "");
console.log("[inject-base] 404.html + .nojekyll OK");
