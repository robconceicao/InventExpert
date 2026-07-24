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
