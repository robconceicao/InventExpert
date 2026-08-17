import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';

import { decodificarTexto } from './fileFormat';
import { lerArquivoDetectado, readWorkbook } from './fileImport';
import { abrirComoWorkbook, ErroLeituraArquivo } from './spreadsheetReader';

/**
 * Picker sem filtro de MIME, em todas as funções deste arquivo.
 *
 * Lista de `type` deixa .xls/.prc/.txt cinza e inselecionáveis no Android, que
 * entrega esses arquivos como `application/octet-stream`. Quem valida o formato
 * é o leitor, pelo conteúdo — ver `fileFormat.ts`.
 */
const PICKER_QUALQUER_ARQUIVO = {
  type: '*/*',
  copyToCacheDirectory: true,
} as const;

/**
 * Utilitário global para abrir arquivos Excel ou CSV e convertê-los em JSON
 * Compatível com iOS, Android e Web.
 */
export async function pickAndParseExcel<T = any>(): Promise<{ dados: T[]; erro?: string }> {
  let nomeArquivo = 'arquivo';
  try {
    const result = await DocumentPicker.getDocumentAsync({
      ...PICKER_QUALQUER_ARQUIVO,
      multiple: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { dados: [] }; // Cancelamento silencioso
    }

    const { uri, name } = result.assets[0];
    if (name) nomeArquivo = name;

    const workbook = await readWorkbook(uri, name ?? undefined);

    if (workbook.SheetNames.length === 0) {
      return { dados: [], erro: `"${nomeArquivo}" não contém nenhuma aba de dados.` };
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Converter para JSON de forma plana
    const jsonData = XLSX.utils.sheet_to_json<T>(worksheet, { defval: null, raw: false });

    return { dados: jsonData };
  } catch (error) {
    console.error('[ExcelParser] Falha Crítica:', error);
    if (error instanceof ErroLeituraArquivo) {
      return { dados: [], erro: error.message };
    }
    return {
      dados: [],
      erro: `Não foi possível ler "${nomeArquivo}". Aceitos: XLS, XLSX, CSV ou TXT.`,
    };
  }
}

/**
 * Lê a primeira aba de uma planilha como MATRIZ (array de arrays), sem tentar
 * inferir cabeçalho.
 *
 * Relatórios do Crystal Reports — ACURACIDADE, PROD_SEÇÃO, NAO CONTADOS — trazem
 * título, filtros e células mescladas antes da linha de cabeçalho, e colunas
 * espalhadas por dezenas de posições vazias. Em modo objeto (`sheet_to_json`
 * com cabeçalho) o resultado é inutilizável; em matriz, cada parser localiza a
 * própria linha de cabeçalho e as próprias colunas.
 *
 * Texto vs planilha é decidido pelos bytes, nunca pela extensão: o mesmo
 * relatório sai ora como .xls binário, ora como tabela HTML com extensão .xls,
 * e o Android costuma entregar o arquivo sem extensão no cache do picker.
 */
export async function pickSheetAsMatrix(): Promise<{
  matriz: any[][];
  nome?: string;
  erro?: string;
  /** true quando o usuário fechou o seletor — a tela deve ficar calada. */
  cancelado?: boolean;
}> {
  let nomeArquivo = 'arquivo';
  try {
    const result = await DocumentPicker.getDocumentAsync(PICKER_QUALQUER_ARQUIVO);
    if (result.canceled || !result.assets?.length) return { matriz: [], cancelado: true };

    const { uri, name } = result.assets[0];
    if (name) nomeArquivo = name;

    const arquivo = await lerArquivoDetectado(uri);

    // CSV/TXT/TSV: o parser próprio detecta o separador e preserva o texto em
    // pt-BR, sem o SheetJS tentar adivinhar o tipo de cada célula.
    if (arquivo.formato === 'TEXTO') {
      const matriz = csvParaMatriz(decodificarTexto(arquivo.bytes()));
      return matriz.length > 0
        ? { matriz, nome: name }
        : { matriz: [], nome: name, erro: `"${nomeArquivo}" está vazio.` };
    }

    const wb = abrirComoWorkbook(arquivo, nomeArquivo);
    if (wb.SheetNames.length === 0) {
      return { matriz: [], nome: name, erro: `"${nomeArquivo}" não tem nenhuma aba.` };
    }
    const matriz = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
      defval: null,
      raw: true,
      blankrows: true,
    });
    if (matriz.length === 0) {
      return {
        matriz: [],
        nome: name,
        erro: `A aba "${wb.SheetNames[0]}" de "${nomeArquivo}" não tem nenhuma linha.`,
      };
    }
    return { matriz, nome: name };
  } catch (error) {
    console.error('[ExcelParser] Falha ao ler matriz:', error);
    if (error instanceof ErroLeituraArquivo) {
      return { matriz: [], erro: error.message };
    }
    return { matriz: [], erro: `Não foi possível ler "${nomeArquivo}" (XLS, XLSX ou CSV).` };
  }
}

/** Converte texto CSV/TSV em matriz, detectando o separador. */
export function csvParaMatriz(texto: string): any[][] {
  const sep = texto.includes('\t') ? '\t' : texto.includes(';') ? ';' : ',';
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.split(sep).map((c) => c.replace(/^"|"$/g, '').trim()));
}
