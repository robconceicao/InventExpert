/**
 * Expo dynamic config — injects Supabase credentials from environment.
 * Prefer EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
 * or EAS Secrets. Never commit live keys to app.json.
 *
 * Web pública = export deste mesmo app:
 *   EXPO_WEB_BASE=/InventExpert
 *   https://robconceicao.github.io/InventExpert/
 */
const appJson = require("./app.json");

const expo = appJson.expo || appJson;

/** Base path GitHub Pages (sem trailing slash). Ex.: /InventExpert */
const webBase = (process.env.EXPO_WEB_BASE || "").replace(/\/$/, "") || undefined;

module.exports = {
  expo: {
    ...expo,
    experiments: {
      ...(expo.experiments || {}),
      ...(webBase ? { baseUrl: webBase } : {}),
    },
    extra: {
      ...(expo.extra || {}),
      supabaseUrl:
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        expo.extra?.supabaseUrl ||
        "",
      supabaseAnonKey:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        expo.extra?.supabaseAnonKey ||
        "",
      webBase: webBase || "",
    },
  },
};
