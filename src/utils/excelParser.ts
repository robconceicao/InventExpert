import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';

import { readWorkbook } from './fileImport';
import { ErroLeituraArquivo } from './spreadsheetReader';

/**
 * Utilitário global para abrir arquivos Excel ou CSV e convertê-los em JSON
 * Compatível com iOS, Android e Web.
 *
 * O picker aceita qualquer MIME de propósito: filtrar esconde (deixa cinza) os
 * arquivos do inventário, porque o Android entrega `application/octet-stream`
 * para .xls vindos de WhatsApp, e-mail e pastas do coletor. A validação real é
 * feita depois, pelo conteúdo do arquivo — ver `fileImport`/`fileFormat`.
 */
export async function pickAndParseExcel<T = any>(): Promise<{ dados: T[]; erro?: string }> {
  let nomeArquivo = 'arquivo';
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
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
