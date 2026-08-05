/**
 * Persistência local de gerações de PDF do scanner.
 * - Metadados: AsyncStorage
 * - Imagens e PDFs: FileSystem.documentDirectory (não cache)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import type { FolhaEscaneada } from "../utils/folhaEscaneada";
import {
  buildGeracaoPdf,
  createGeracaoId,
  idsDaCadeia,
  ordenarGeracoesRecentes,
  removerGeracoes,
  resolveRootId,
  somarTamanhoBytes,
  type FolhaArquivada,
  type GeracaoPdf,
} from "../utils/scannerGeracao";

export const STORAGE_KEY = "inventexpert:scanner_geracoes";

function rootDir(): string {
  const base = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
  return `${base}scanner/`;
}

function geracaoDir(geracaoId: string): string {
  return `${rootDir()}${geracaoId}/`;
}

function folhasDir(geracaoId: string): string {
  return `${geracaoDir(geracaoId)}folhas/`;
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().replace(/[/\\?%*:|"<>]/g, "_");
  if (!trimmed) return `relatorio_${Date.now()}`;
  return trimmed.endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
}

function extFromUri(uri: string): string {
  const clean = uri.split("?")[0] ?? uri;
  const m = clean.match(/\.([a-zA-Z0-9]+)$/);
  if (!m) return "jpg";
  const ext = m[1].toLowerCase();
  if (ext === "jpeg") return "jpg";
  if (["jpg", "png", "webp", "heic"].includes(ext)) return ext;
  return "jpg";
}

async function ensureDir(path: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

/** Tamanho em bytes (0 quando o arquivo não existe ou o SO não informa). */
async function fileSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return 0;
    return Number.isFinite(info.size) ? info.size : 0;
  } catch {
    return 0;
  }
}

async function copyFile(from: string, to: string): Promise<void> {
  const destInfo = await FileSystem.getInfoAsync(to);
  if (destInfo.exists) {
    await FileSystem.deleteAsync(to, { idempotent: true });
  }
  await FileSystem.copyAsync({ from, to });
}

/** Lê o índice de gerações (mais recentes primeiro). */
export async function listarGeracoes(): Promise<GeracaoPdf[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GeracaoPdf[];
    if (!Array.isArray(parsed)) return [];
    return ordenarGeracoesRecentes(parsed);
  } catch {
    return [];
  }
}

async function persistirIndice(lista: GeracaoPdf[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

export async function obterGeracao(
  geracaoId: string,
): Promise<GeracaoPdf | null> {
  const todas = await listarGeracoes();
  return todas.find((g) => g.geracaoId === geracaoId) ?? null;
}

/**
 * Arquiva folhas + PDF de uma geração (original ou correção).
 * Copia arquivos para documentDirectory; não altera a geração base.
 */
export async function arquivarGeracao(params: {
  folhas: FolhaEscaneada[];
  nomePdf: string;
  pdfSourceUri: string;
  /** Se informado, esta geração é uma correção vinculada à raiz da base. */
  base?: GeracaoPdf | null;
}): Promise<GeracaoPdf> {
  const folhasValidas = params.folhas.filter(
    (f) => typeof f.uri === "string" && f.uri.trim().length > 0,
  );
  if (folhasValidas.length === 0) {
    throw new Error("Nenhuma folha válida para arquivar.");
  }
  if (!params.pdfSourceUri?.trim()) {
    throw new Error("PDF de origem inválido.");
  }

  const existentes = await listarGeracoes();
  const geracaoId = createGeracaoId();
  const dir = geracaoDir(geracaoId);
  const dirFolhas = folhasDir(geracaoId);
  await ensureDir(dirFolhas);

  const folhasArquivadas: FolhaArquivada[] = [];
  for (const folha of folhasValidas) {
    const ext = extFromUri(folha.uri);
    const destUri = `${dirFolhas}${folha.id}.${ext}`;
    await copyFile(folha.uri, destUri);
    folhasArquivadas.push({
      id: folha.id,
      uri: destUri,
      ordem: folha.ordem,
      timestamp: folha.timestamp,
    });
  }

  const pdfName = sanitizeFileName(params.nomePdf);
  const pdfDest = `${dir}${pdfName}`;
  await copyFile(params.pdfSourceUri, pdfDest);

  const tamanhos = await Promise.all(
    [pdfDest, ...folhasArquivadas.map((f) => f.uri)].map(fileSize),
  );
  const tamanhoBytes = tamanhos.reduce((total, n) => total + n, 0);

  const registro = {
    ...buildGeracaoPdf({
      geracaoId,
      nomePdf: pdfName.replace(/\.pdf$/i, ""),
      pdfUri: pdfDest,
      folhas: folhasArquivadas,
      base: params.base ?? null,
      existentes,
    }),
    tamanhoBytes,
  };

  const atualizado = ordenarGeracoesRecentes([registro, ...existentes]);
  await persistirIndice(atualizado);
  return registro;
}

export interface ResultadoExclusao {
  /** Quantas gerações saíram do índice. */
  removidos: number;
  /** Bytes liberados (0 quando os registros não têm medida). */
  bytesLiberados: number;
  /** Índice já atualizado, mais recentes primeiro. */
  restantes: GeracaoPdf[];
}

/** Apaga os arquivos de uma geração (diretório + PDF/folhas fora dele). */
async function apagarArquivosDaGeracao(geracao: GeracaoPdf): Promise<void> {
  const dir = geracaoDir(geracao.geracaoId);
  await FileSystem.deleteAsync(dir, { idempotent: true });

  // Defensivo: registros antigos podem ter arquivos fora do diretório padrão
  const soltos = [geracao.pdfUri, ...geracao.folhas.map((f) => f.uri)].filter(
    (uri) => typeof uri === "string" && uri.trim() && !uri.startsWith(dir),
  );
  for (const uri of soltos) {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // arquivo já ausente ou sem permissão — segue
    }
  }
}

/**
 * Exclui uma geração arquivada (arquivos + índice).
 * `incluirCadeia` remove também todas as outras versões do mesmo original.
 */
export async function excluirGeracao(
  geracaoId: string,
  opcoes?: { incluirCadeia?: boolean },
): Promise<ResultadoExclusao> {
  const todas = await listarGeracoes();
  const alvo = todas.find((g) => g.geracaoId === geracaoId);
  if (!alvo) {
    return { removidos: 0, bytesLiberados: 0, restantes: todas };
  }

  const ids = opcoes?.incluirCadeia
    ? idsDaCadeia(todas, resolveRootId(alvo))
    : [alvo.geracaoId];
  const alvos = todas.filter((g) => ids.includes(g.geracaoId));

  for (const g of alvos) {
    await apagarArquivosDaGeracao(g);
  }

  const restantes = ordenarGeracoesRecentes(removerGeracoes(todas, ids));
  await persistirIndice(restantes);

  return {
    removidos: alvos.length,
    bytesLiberados: somarTamanhoBytes(alvos),
    restantes,
  };
}

/** Limpa todo o histórico: apaga o diretório do scanner e zera o índice. */
export async function excluirTodasGeracoes(): Promise<ResultadoExclusao> {
  const todas = await listarGeracoes();
  try {
    await FileSystem.deleteAsync(rootDir(), { idempotent: true });
  } catch {
    // fallback: apaga geração a geração
    for (const g of todas) {
      await apagarArquivosDaGeracao(g);
    }
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
  return {
    removidos: todas.length,
    bytesLiberados: somarTamanhoBytes(todas),
    restantes: [],
  };
}
