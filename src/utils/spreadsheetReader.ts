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

/**
 * Arquivo lido, com o formato reconhecido pelo conteúdo.
 *
 * `bytes()` decodifica sob demanda e memoiza. Planilha binária (XLS/XLSX) vai
 * direto do `base64` para o SheetJS e **nunca** paga esse custo: decodificar um
 * ACURACIDADE de 6 MB só para farejar 4 KB de assinatura chegava a travar o
 * aparelho sem mensagem nenhuma.
 */
export type ArquivoLido = {
  /** Conteúdo original em base64 — caminho direto para o SheetJS binário. */
  base64: string;
  /** Primeiros bytes, o suficiente para identificar o formato. */
  amostra: Uint8Array;
  formato: FormatoArquivo;
  /** Bytes completos, decodificados na primeira chamada. */
  bytes: () => Uint8Array;
  /** Tamanho aproximado do arquivo, sem decodificar. */
  tamanhoBytes: number;
};

export function identificarArquivo(
  base64: string,
  decodificar: (limite?: number) => Uint8Array,
): ArquivoLido {
  const amostra = decodificar(BYTES_DE_DETECCAO);
  let completo: Uint8Array | null = null;
  return {
    base64,
    amostra,
    formato: detectarFormato(amostra),
    bytes: () => (completo ??= decodificar()),
    tamanhoBytes: Math.floor((base64.length * 3) / 4),
  };
}

/**
 * Abre o arquivo como workbook, escolhendo o caminho pelo formato real.
 *
 * `rotulo` é só o nome exibido na mensagem de erro.
 */
export function abrirComoWorkbook(arquivo: ArquivoLido, rotulo: string): XLSX.WorkBook {
  if (arquivo.tamanhoBytes === 0) {
    throw new ErroLeituraArquivo(`O arquivo "${rotulo}" está vazio.`);
  }

  try {
    switch (arquivo.formato) {
      case "XLSX":
      case "XLS":
        // Fórmula, estilo e HTML de célula não são usados por nenhum parser do
        // app e multiplicam a memória num relatório de milhares de linhas —
        // que é justamente onde a leitura travava no aparelho.
        return XLSX.read(arquivo.base64, {
          type: "base64",
          cellFormula: false,
          cellHTML: false,
          cellStyles: false,
        });

      case "HTML":
      case "XML": {
        // Export "Excel" do Crystal Reports: é HTML (às vezes MHTML) com
        // extensão .xls. O SheetJS só entende isso como string, nunca como
        // base64 binário — e o texto precisa vir com o encoding já resolvido.
        const texto = decodificarTexto(arquivo.bytes());
        const html = extrairHtmlDeMhtml(texto) ?? texto;
        // `raw: true` mantém a célula como texto: sem isso o SheetJS decide o
        // separador decimal por conta própria e "1,73%" chega ao parser como
        // "1.73". Os parsers do app já leem o formato pt-BR original.
        return XLSX.read(html, { type: "string", raw: true });
      }

      default:
        // CSV/TXT também abrem no SheetJS: ele detecta o separador sozinho.
        return XLSX.read(decodificarTexto(arquivo.bytes()), { type: "string", raw: true });
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
  if (arquivo.tamanhoBytes === 0) {
    throw new ErroLeituraArquivo(`O arquivo "${rotulo}" está vazio.`);
  }
  if (arquivo.formato === "TEXTO") {
    return decodificarTexto(arquivo.bytes());
  }
  return primeiraPlanilhaParaCsv(abrirComoWorkbook(arquivo, rotulo));
}
