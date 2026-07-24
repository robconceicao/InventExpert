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
  ordenarGeracoesRecentes,
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

  const registro = buildGeracaoPdf({
    geracaoId,
    nomePdf: pdfName.replace(/\.pdf$/i, ""),
    pdfUri: pdfDest,
    folhas: folhasArquivadas,
    base: params.base ?? null,
    existentes,
  });

  const atualizado = ordenarGeracoesRecentes([registro, ...existentes]);
  await persistirIndice(atualizado);
  return registro;
}
