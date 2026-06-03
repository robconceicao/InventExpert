/** Normaliza nome para chave de mapa (minúsculas, sem acentos). */
export function normalizeNomeKey(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NOME_MATCH_MIN_CHARS = 12;

/**
 * Match exato ou por prefixo (nomes truncados no export do cliente).
 */
export function matchNomes(a: string, b: string): boolean {
  const na = normalizeNomeKey(a);
  const nb = normalizeNomeKey(b);
  if (na === nb) return true;
  const shorter = na.length < nb.length ? na : nb;
  if (shorter.length < NOME_MATCH_MIN_CHARS) return false;
  const prefix = shorter.slice(0, NOME_MATCH_MIN_CHARS);
  return na.startsWith(prefix) || nb.startsWith(prefix);
}

/** Busca dados de tags cruzando nome da planilha de produtividade. */
export function lookupTagsPorColaborador<T>(
  map: Record<string, T>,
  nomeProdutividade: string,
): T | undefined {
  const key = normalizeNomeKey(nomeProdutividade);
  if (map[key]) return map[key];
  for (const [mapKey, value] of Object.entries(map)) {
    if (matchNomes(mapKey, key)) return value;
  }
  return undefined;
}
