/**
 * Diz para qual projeto Supabase o build aponta — SPEC 0007.
 *
 * A URL e a chave ficam gravadas no build. Quando o login falha por rede, a
 * única pista que chega do aparelho é o print da tela; com o host nele dá para
 * saber na hora se o build aponta para o projeto certo.
 */

export interface DiagnosticoSupabase {
  /** null = URL vazia ou sem esquema://host */
  host: string | null;
  /** Subdomínio de *.supabase.co; null em domínio próprio. */
  refUrl: string | null;
  /** Claim "ref" do JWT da anon key; null se a chave não for JWT. */
  refChave: string | null;
  /** true só quando os dois refs são conhecidos e diferem. */
  divergente: boolean;
}

/** Regex em vez de `new URL()`: o URL do React Native não implementa `host` sempre. */
export function hostDaUrl(url: string): string | null {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#\s]+)/i.exec(url.trim());
  return m ? m[1].toLowerCase() : null;
}

export function refDoHost(host: string | null): string | null {
  if (!host) return null;
  const m = /^([a-z0-9]+)\.supabase\.(co|in)(:\d+)?$/.exec(host);
  return m ? m[1] : null;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** base64url → texto, sem depender de `atob`/`Buffer` no motor JS. */
function decodificarBase64Url(entrada: string): string | null {
  const s = entrada.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  let bits = 0;
  let acumulado = 0;
  let saida = "";
  for (const c of s) {
    const v = B64.indexOf(c);
    if (v < 0) return null;
    acumulado = (acumulado << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      saida += String.fromCharCode((acumulado >> bits) & 0xff);
    }
  }
  return saida;
}

export function refDaChave(anonKey: string): string | null {
  const partes = anonKey.trim().split(".");
  if (partes.length !== 3) return null;
  const json = decodificarBase64Url(partes[1]);
  if (!json) return null;
  try {
    const ref = JSON.parse(json)?.ref;
    return typeof ref === "string" && ref ? ref : null;
  } catch {
    return null;
  }
}

export function diagnosticarSupabase(url: string, anonKey: string): DiagnosticoSupabase {
  const host = hostDaUrl(url ?? "");
  const refUrl = refDoHost(host);
  const refChave = refDaChave(anonKey ?? "");
  return {
    host,
    refUrl,
    refChave,
    divergente: Boolean(refUrl && refChave && refUrl !== refChave),
  };
}
