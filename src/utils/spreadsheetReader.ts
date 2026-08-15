/**
 * Conversão de bytes → planilha → CSV.
 *
 * Fica separado de `fileImport` de propósito: aqui não há React Native nem
 * expo, só `xlsx` e a detecção de formato. É o miolo do import da Avaliação e
 * roda inteiro no Jest.
 */
import * as XLSX from "xlsx";

import {
  BYTES_DE_DETECCAO,
  decodificarTexto,
  descreverFormato,
  detectarFormato,
  extrairHtmlDeMhtml,
  type FormatoArquivo,
} from "./fileFormat";

/** Erro de leitura com mensagem pronta para o Alert da tela. */
export class ErroLeituraArquivo extends Error {
  readonly formato: FormatoArquivo | null;

  constructor(mensagem: string, formato: FormatoArquivo | null = null) {
    super(mensagem);
    this.name = "ErroLeituraArquivo";
    this.formato = formato;
  }
}

/** Bytes do arquivo já lidos, com o formato reconhecido pelo conteúdo. */
export type ArquivoLido = {
  /** Conteúdo original em base64 — caminho direto para o SheetJS binário. */
  base64: string;
  bytes: Uint8Array;
  formato: FormatoArquivo;
};

export function identificarArquivo(base64: string, bytes: Uint8Array): ArquivoLido {
  return {
    base64,
    bytes,
    formato: detectarFormato(bytes.subarray(0, BYTES_DE_DETECCAO)),
  };
}

/**
 * Abre o arquivo como workbook, escolhendo o caminho pelo formato real.
 *
 * `rotulo` é só o nome exibido na mensagem de erro.
 */
export function abrirComoWorkbook(arquivo: ArquivoLido, rotulo: string): XLSX.WorkBook {
  if (arquivo.bytes.length === 0) {
    throw new ErroLeituraArquivo(`O arquivo "${rotulo}" está vazio.`);
  }

  try {
    switch (arquivo.formato) {
      case "XLSX":
      case "XLS":
        return XLSX.read(arquivo.base64, { type: "base64" });

      case "HTML":
      case "XML": {
        // Export "Excel" do Crystal Reports: é HTML (às vezes MHTML) com
        // extensão .xls. O SheetJS só entende isso como string, nunca como
        // base64 binário — e o texto precisa vir com o encoding já resolvido.
        const texto = decodificarTexto(arquivo.bytes);
        const html = extrairHtmlDeMhtml(texto) ?? texto;
        // `raw: true` mantém a célula como texto: sem isso o SheetJS decide o
        // separador decimal por conta própria e "1,73%" chega ao parser como
        // "1.73". Os parsers do app já leem o formato pt-BR original.
        return XLSX.read(html, { type: "string", raw: true });
      }

      default:
        // CSV/TXT também abrem no SheetJS: ele detecta o separador sozinho.
        return XLSX.read(decodificarTexto(arquivo.bytes), { type: "string", raw: true });
    }
  } catch (erro) {
    if (erro instanceof ErroLeituraArquivo) throw erro;
    throw new ErroLeituraArquivo(
      `Não foi possível abrir "${rotulo}" (${descreverFormato(arquivo.formato)}).`,
      arquivo.formato,
    );
  }
}

/** Primeira aba do workbook como CSV com `;` — formato que os parsers esperam. */
export function primeiraPlanilhaParaCsv(workbook: XLSX.WorkBook): string {
  const nomeAba = workbook.SheetNames[0];
  if (!nomeAba) {
    throw new ErroLeituraArquivo("A planilha não tem nenhuma aba de dados.");
  }
  return XLSX.utils.sheet_to_csv(workbook.Sheets[nomeAba], { FS: ";" });
}

/**
 * Conteúdo do arquivo no formato que os parsers do app consomem.
 *
 * Planilha (XLS/XLSX/HTML/XML) → CSV com `;`. Texto (CSV/TXT/PRC) → conteúdo
 * cru, já decodificado com o encoding certo.
 */
export function arquivoParaTextoTabular(arquivo: ArquivoLido, rotulo: string): string {
  if (arquivo.bytes.length === 0) {
    throw new ErroLeituraArquivo(`O arquivo "${rotulo}" está vazio.`);
  }
  if (arquivo.formato === "TEXTO") {
    return decodificarTexto(arquivo.bytes);
  }
  return primeiraPlanilhaParaCsv(abrirComoWorkbook(arquivo, rotulo));
}
