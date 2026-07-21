/**
 * Modelo e operações puras para folhas escaneadas na revisão pós-scanner.
 * Identidade estável via `id` (uuid); `ordem` é sempre recalculada.
 */

export interface FolhaEscaneada {
  id: string;
  uri: string;
  ordem: number;
  timestamp: number;
}

/** Gera uuid v4-like estável o bastante para identidade de lista em sessão. */
export function createFolhaId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Recalcula `ordem` 1..n na sequência atual (preserva `id` e `uri`). */
export function renumerarFolhas(lista: FolhaEscaneada[]): FolhaEscaneada[] {
  return lista.map((folha, index) => ({
    ...folha,
    ordem: index + 1,
  }));
}

/** Cria folhas a partir de URIs capturadas (ordem = posição na captura). */
export function folhasFromUris(
  uris: string[],
  startOrdem = 1,
): FolhaEscaneada[] {
  const now = Date.now();
  return uris
    .filter((uri): uri is string => typeof uri === "string" && uri.trim().length > 0)
    .map((uri, index) => ({
      id: createFolhaId(),
      uri,
      ordem: startOrdem + index,
      timestamp: now + index,
    }));
}

export function excluirFolha(
  lista: FolhaEscaneada[],
  id: string,
): FolhaEscaneada[] {
  return renumerarFolhas(lista.filter((f) => f.id !== id));
}

/**
 * Substitui a URI da folha com `id`, mantendo posição e identidade.
 * Se o id não existir, retorna a lista inalterada.
 */
export function reescanearFolhaNaLista(
  lista: FolhaEscaneada[],
  id: string,
  novaUri: string,
): FolhaEscaneada[] {
  if (!novaUri?.trim()) return lista;
  return lista.map((f) =>
    f.id === id
      ? { ...f, uri: novaUri, timestamp: Date.now() }
      : f,
  );
}

/**
 * Insere uma nova folha logo após a de `idReferencia` e renumerar.
 * Se a referência não existir, anexa ao final.
 */
export function inserirDepoisNaLista(
  lista: FolhaEscaneada[],
  idReferencia: string,
  novaUri: string,
): FolhaEscaneada[] {
  if (!novaUri?.trim()) return lista;
  const nova: FolhaEscaneada = {
    id: createFolhaId(),
    uri: novaUri,
    ordem: 0,
    timestamp: Date.now(),
  };
  const idx = lista.findIndex((f) => f.id === idReferencia);
  if (idx < 0) {
    return renumerarFolhas([...lista, nova]);
  }
  return renumerarFolhas([
    ...lista.slice(0, idx + 1),
    nova,
    ...lista.slice(idx + 1),
  ]);
}

/** Aplica nova ordem da lista (ex.: drag-and-drop) e renumerar. */
export function reordenarFolhas(novaLista: FolhaEscaneada[]): FolhaEscaneada[] {
  return renumerarFolhas(novaLista);
}

/** URIs na ordem de revisão — o que vai para PDF/processamento. */
export function urisOrdenadas(lista: FolhaEscaneada[]): string[] {
  return renumerarFolhas(lista).map((f) => f.uri);
}
