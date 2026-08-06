/**
 * Modelo e helpers puros para gerações de PDF do scanner.
 * Persistência de arquivos fica em scannerGeracaoStorage.
 */

import type { FolhaEscaneada } from "./folhaEscaneada";
import { createFolhaId } from "./folhaEscaneada";

/** Folha arquivada com URI permanente no dispositivo. */
export interface FolhaArquivada {
  id: string;
  uri: string;
  ordem: number;
  timestamp: number;
}

/**
 * Uma geração de PDF persistente.
 * - Original: geracaoOriginalId = null, versao = 1
 * - Correção: geracaoOriginalId = id da raiz (v1), versao = 2, 3, …
 */
export interface GeracaoPdf {
  geracaoId: string;
  geracaoOriginalId: string | null;
  versao: number;
  nomePdf: string;
  criadoEm: string;
  pdfUri: string;
  folhas: FolhaArquivada[];
  qtdFolhas: number;
  /** Bytes ocupados (PDF + folhas). Ausente em registros antigos. */
  tamanhoBytes?: number;
}

export function createGeracaoId(): string {
  return createFolhaId();
}

/** Id da raiz da cadeia de versões (a v1). */
export function resolveRootId(geracao: Pick<GeracaoPdf, "geracaoId" | "geracaoOriginalId">): string {
  return geracao.geracaoOriginalId ?? geracao.geracaoId;
}

/** Próximo número de versão na cadeia da raiz. */
export function nextVersaoNaCadeia(
  todas: Array<Pick<GeracaoPdf, "geracaoId" | "geracaoOriginalId" | "versao">>,
  rootId: string,
): number {
  const naCadeia = todas.filter(
    (g) => g.geracaoId === rootId || g.geracaoOriginalId === rootId,
  );
  if (naCadeia.length === 0) return 1;
  return Math.max(...naCadeia.map((g) => g.versao)) + 1;
}

export function rotuloVersao(geracao: Pick<GeracaoPdf, "versao">): string {
  return `v${geracao.versao}`;
}

/** Ids de todas as gerações da cadeia da raiz (inclui a própria raiz). */
export function idsDaCadeia(
  todas: Array<Pick<GeracaoPdf, "geracaoId" | "geracaoOriginalId">>,
  rootId: string,
): string[] {
  return todas
    .filter((g) => g.geracaoId === rootId || g.geracaoOriginalId === rootId)
    .map((g) => g.geracaoId);
}

/** Quantas outras versões existem na mesma cadeia da geração informada. */
export function contarOutrasVersoesNaCadeia(
  todas: Array<Pick<GeracaoPdf, "geracaoId" | "geracaoOriginalId">>,
  geracao: Pick<GeracaoPdf, "geracaoId" | "geracaoOriginalId">,
): number {
  const ids = idsDaCadeia(todas, resolveRootId(geracao));
  return ids.filter((id) => id !== geracao.geracaoId).length;
}

/**
 * Remove gerações do índice por id.
 * Se uma raiz cair e ainda restarem correções dela, a versão mais antiga
 * remanescente vira a nova raiz (evita órfãos apontando para id inexistente).
 * Os números de versão são preservados — não há renumeração.
 */
export function removerGeracoes(
  lista: GeracaoPdf[],
  ids: string[],
): GeracaoPdf[] {
  const remover = new Set(ids);
  const restantes = lista.filter((g) => !remover.has(g.geracaoId));
  const presentes = new Set(restantes.map((g) => g.geracaoId));

  // Agrupa órfãos (perderam a raiz) pelo id de raiz antigo
  const novaRaizPorRoot = new Map<string, string>();
  for (const g of restantes) {
    const rootId = g.geracaoOriginalId;
    if (!rootId || presentes.has(rootId)) continue;
    const atual = novaRaizPorRoot.get(rootId);
    if (!atual) {
      novaRaizPorRoot.set(rootId, g.geracaoId);
      continue;
    }
    const candidato = restantes.find((r) => r.geracaoId === atual);
    if (candidato && g.versao < candidato.versao) {
      novaRaizPorRoot.set(rootId, g.geracaoId);
    }
  }

  return restantes.map((g) => {
    const rootId = g.geracaoOriginalId;
    if (!rootId || presentes.has(rootId)) return g;
    const novaRaiz = novaRaizPorRoot.get(rootId);
    if (!novaRaiz) return g;
    return {
      ...g,
      geracaoOriginalId: g.geracaoId === novaRaiz ? null : novaRaiz,
    };
  });
}

/** Soma o espaço ocupado (bytes) das gerações que registram tamanho. */
export function somarTamanhoBytes(
  lista: Array<Pick<GeracaoPdf, "tamanhoBytes">>,
): number {
  return lista.reduce((total, g) => total + (g.tamanhoBytes ?? 0), 0);
}

/** Formata bytes em texto curto (pt-BR). Retorna null se não houver medida. */
export function formatarBytes(bytes: number | undefined | null): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0).replace(".", ",")} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0).replace(".", ",")} MB`;
}

/** Texto de UI para correções (null se for a original). */
export function rotuloCorrecao(
  geracao: Pick<GeracaoPdf, "versao" | "criadoEm" | "geracaoOriginalId">,
  formatDate: (iso: string) => string = formatDataHoraBr,
): string | null {
  if (geracao.versao <= 1 || !geracao.geracaoOriginalId) return null;
  return `Corrigido em ${formatDate(geracao.criadoEm)}`;
}

export function formatDataHoraBr(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Converte folhas arquivadas no modelo de revisão em memória. */
export function folhasArquivadasParaRevisao(
  folhas: FolhaArquivada[],
): FolhaEscaneada[] {
  return folhas
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((f, index) => ({
      id: f.id,
      uri: f.uri,
      ordem: index + 1,
      timestamp: f.timestamp,
    }));
}

/** Ordena gerações da mais recente para a mais antiga. */
export function ordenarGeracoesRecentes(lista: GeracaoPdf[]): GeracaoPdf[] {
  return lista
    .slice()
    .sort(
      (a, b) =>
        new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(),
    );
}

/**
 * Monta o registro de uma nova geração (sem I/O).
 * folhas e pdfUri já devem apontar para caminhos permanentes.
 */
export function buildGeracaoPdf(params: {
  geracaoId: string;
  nomePdf: string;
  pdfUri: string;
  folhas: FolhaArquivada[];
  criadoEm?: string;
  /** Geração sendo corrigida (se houver). */
  base?: Pick<GeracaoPdf, "geracaoId" | "geracaoOriginalId" | "versao"> | null;
  /** Lista completa para calcular próxima versão. */
  existentes?: Array<
    Pick<GeracaoPdf, "geracaoId" | "geracaoOriginalId" | "versao">
  >;
}): GeracaoPdf {
  const existentes = params.existentes ?? [];
  let geracaoOriginalId: string | null = null;
  let versao = 1;

  if (params.base) {
    const rootId = resolveRootId(params.base);
    geracaoOriginalId = rootId;
    versao = nextVersaoNaCadeia(existentes, rootId);
  }

  const folhas = params.folhas
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((f, i) => ({ ...f, ordem: i + 1 }));

  return {
    geracaoId: params.geracaoId,
    geracaoOriginalId,
    versao,
    nomePdf: params.nomePdf,
    criadoEm: params.criadoEm ?? new Date().toISOString(),
    pdfUri: params.pdfUri,
    folhas,
    qtdFolhas: folhas.length,
  };
}
