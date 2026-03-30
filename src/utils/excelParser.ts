import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';

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

    const { uri, name } = result.assets[0];
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
