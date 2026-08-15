import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import { readFileAsCsvText } from './fileImport';

/**
 * Utilitário global para abrir arquivos Excel ou CSV e convertê-los em JSON
 * Compatível com iOS, Android e Web.
 */
export async function pickAndParseExcel<T = any>(): Promise<{ dados: T[]; erro?: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
      ],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { dados: [] }; // Cancelamento silencioso
    }

    const { uri } = result.assets[0];
    let fileContentBase64 = '';

    // A leitura de ficheiros muda muito entre o Motor Web vs Motor Mobile (iOS/Android)
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      fileContentBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result?.toString().split(',')[1] || '';
          resolve(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      fileContentBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
    }

    // Leitura do binário base64 via biblioteca nativa SheetJS / XLSX
    const workbook = XLSX.read(fileContentBase64, { type: 'base64' });
    
    if (workbook.SheetNames.length === 0) {
      return { dados: [], erro: 'O arquivo parece não conter nenhuma aba de dados.' };
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Converter para JSON de forma plana
    const jsonData = XLSX.utils.sheet_to_json<T>(worksheet, { defval: null, raw: false });

    return { dados: jsonData };
  } catch (error) {
    console.error('[ExcelParser] Falha Crítica:', error);
    return { dados: [], erro: 'Não foi possível ler a planilha. Certifique-se que o formato está correto (XLSX, CSV).' };
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
 */
export async function pickSheetAsMatrix(): Promise<{ matriz: any[][]; nome?: string; erro?: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return { matriz: [] };

    const { uri, name } = result.assets[0];
    const ehTexto = /\.(csv|txt|tsv)$/i.test(name || '');

    if (ehTexto) {
      const texto = await readFileAsCsvText(uri);
      return { matriz: csvParaMatriz(texto), nome: name };
    }

    let base64 = '';
    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result?.toString().split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    }

    const wb = XLSX.read(base64, { type: 'base64' });
    if (wb.SheetNames.length === 0) return { matriz: [], erro: 'A planilha não tem nenhuma aba.' };
    const matriz = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
      defval: null,
      raw: true,
      blankrows: true,
    });
    return { matriz, nome: name };
  } catch (error) {
    console.error('[ExcelParser] Falha ao ler matriz:', error);
    return { matriz: [], erro: 'Não foi possível ler a planilha (XLS, XLSX ou CSV).' };
  }
}

/** Converte texto CSV/TSV em matriz, detectando o separador. */
export function csvParaMatriz(texto: string): any[][] {
  const sep = texto.includes('\t') ? '\t' : texto.includes(';') ? ';' : ',';
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.split(sep).map((c) => c.replace(/^"|"$/g, '').trim()));
}
