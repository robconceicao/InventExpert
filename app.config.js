/**
 * Expo dynamic config — injects Supabase credentials from environment.
 * Prefer EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
 * or EAS Secrets. Never commit live keys to app.json.
 *
 * EXPO_WEB_BASE=/inventexpert-web → export web em subpath (GitHub Pages).
 * URL pública: https://robconceicao.github.io/inventexpert-web/
 * (é o MESMO app InventExpert, responsivo no browser — não um produto paralelo)
 */
const appJson = require("./app.json");

const expo = appJson.expo || appJson;

/** Base path para GitHub Pages (sem trailing slash). Ex.: /inventexpert-web */
const webBase = (process.env.EXPO_WEB_BASE || "").replace(/\/$/, "") || undefined;

module.exports = {
  expo: {
    ...expo,
    experiments: {
      ...(expo.experiments || {}),
      // Hosting em subpath: https://docs.expo.dev/more/expo-cli/#hosting-with-sub-paths
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
