import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const escapeCsvValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const buildCsv = (headers: string[], rows: Array<Array<unknown>>) => {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(','));
  return lines.join('\n');
};

export const shareCsvFile = async (
  filename: string,
  headers: string[],
  rows: Array<Array<unknown>>,
) => {
  if (!FileSystem.documentDirectory) {
    throw new Error('Diretório local indisponível.');
  }
  const csv = buildCsv(headers, rows);
  const uri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Compartilhamento não disponível neste dispositivo.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Enviar para OneDrive',
    UTI: 'public.comma-separated-values-text',
  });
};
