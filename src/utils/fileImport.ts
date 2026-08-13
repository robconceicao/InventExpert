import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import type * as XLSX from "xlsx";

import {
  decodeBase64,
  decodificarTexto,
  descreverFormato,
  extrairExtensao,
  type FormatoArquivo,
} from "./fileFormat";
import {
  abrirComoWorkbook,
  arquivoParaTextoTabular,
  ErroLeituraArquivo,
  identificarArquivo,
  type ArquivoLido,
} from "./spreadsheetReader";

export { ErroLeituraArquivo } from "./spreadsheetReader";

function rotularArquivo(nome?: string, uri?: string): string {
  if (nome) return nome;
  const extensao = extrairExtensao(uri ?? "");
  return extensao ? `arquivo .${extensao}` : "arquivo";
}

/** Extensões que prometem planilha — só para diagnóstico, nunca para decidir. */
const EXTENSOES_DE_PLANILHA = ["xls", "xlsx", "xlsm", "xlsb", "ods"];

/**
 * Avisa no console quando a embalagem (extensão/MIME) não bate com o conteúdo.
 *
 * Não muda o resultado — o conteúdo sempre vence —, mas deixa rastro quando um
 * `.xls` do Crystal Reports na verdade é HTML, ou quando o Android manda
 * `octet-stream` para uma planilha legítima.
 */
function avisarDivergencia(
  rotulo: string,
  nomeOuUri: string,
  mimeType: string | undefined,
  formato: FormatoArquivo,
): void {
  const extensao = extrairExtensao(nomeOuUri);
  const prometePlanilha =
    EXTENSOES_DE_PLANILHA.includes(extensao) ||
    /spreadsheet|excel/i.test(mimeType ?? "");
  if (!prometePlanilha) return;

  if (formato === "TEXTO") {
    console.warn(
      `[fileImport] "${rotulo}" tem cara de planilha (.${extensao || "?"} / ${mimeType ?? "sem MIME"}) mas o conteúdo é texto puro — lido como texto.`,
    );
  } else if (formato === "HTML" || formato === "XML") {
    console.warn(
      `[fileImport] "${rotulo}" é ${descreverFormato(formato)} com extensão .${extensao || "?"} — aberto pelo conteúdo.`,
    );
  }
}

/**
 * Lê o arquivo inteiro em base64 — único caminho de leitura do app.
 *
 * Ler sempre em base64 (e não direto em UTF8) é o que permite decidir o formato
 * pelo conteúdo: os mesmos bytes servem para farejar a assinatura, abrir no
 * SheetJS ou decodificar como texto com o encoding certo.
 */
export async function lerArquivoBase64(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const resposta = await fetch(uri);
    const blob = await resposta.blob();
    return await new Promise<string>((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onloadend = () =>
        resolve(String(leitor.result ?? "").split(",")[1] ?? "");
      leitor.onerror = () =>
        reject(leitor.error ?? new Error("Falha ao ler o arquivo no navegador."));
      leitor.readAsDataURL(blob);
    });
  }

  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

async function lerEDetectar(uri: string): Promise<ArquivoLido> {
  const base64 = await lerArquivoBase64(uri);
  return identificarArquivo(base64, decodeBase64(base64));
}

/**
 * Abre qualquer arquivo tabular (XLS, XLSX, HTML do Crystal Reports, CSV) como
 * workbook do SheetJS, decidindo o formato pelo conteúdo.
 */
export async function readWorkbook(
  uri: string,
  nome?: string,
): Promise<XLSX.WorkBook> {
  const rotulo = rotularArquivo(nome, uri);
  return abrirComoWorkbook(await lerEDetectar(uri), rotulo);
}

/**
 * Lê arquivo tabular e devolve texto no formato que os parsers do app esperam.
 *
 * Planilha (XLS/XLSX/HTML/XML) → CSV com `;`. Texto (CSV/TXT) → conteúdo cru,
 * já com o encoding resolvido.
 *
 * `mimeType` e `nome` servem só para mensagem e diagnóstico: o formato real vem
 * sempre dos bytes, porque no Android o MIME chega como `octet-stream` e o nome
 * no cache pode vir sem extensão.
 */
export async function readFileAsCsvText(
  uri: string,
  mimeType?: string,
  nome?: string,
): Promise<string> {
  const rotulo = rotularArquivo(nome, uri);
  const arquivo = await lerEDetectar(uri);
  avisarDivergencia(rotulo, nome ?? uri, mimeType, arquivo.formato);
  return arquivoParaTextoTabular(arquivo, rotulo);
}

/**
 * Lê arquivo de texto (.prc, cadastro.txt, invent_DSP.old) com o encoding
 * resolvido pelo conteúdo — esses arquivos são windows-1252, não UTF-8.
 */
export async function readFileAsText(uri: string, nome?: string): Promise<string> {
  const rotulo = rotularArquivo(nome, uri);
  const arquivo = await lerEDetectar(uri);

  if (arquivo.formato === "XLSX" || arquivo.formato === "XLS") {
    throw new ErroLeituraArquivo(
      `"${rotulo}" é uma ${descreverFormato(arquivo.formato)}, não um arquivo de texto.`,
      arquivo.formato,
    );
  }

  return decodificarTexto(arquivo.bytes);
}
