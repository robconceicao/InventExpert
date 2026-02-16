import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";

/**
 * Lê arquivo CSV ou Excel e retorna texto no formato CSV para o parser.
 */
export async function readFileAsCsvText(uri: string, mimeType?: string): Promise<string> {
  const ext = (uri.split(".").pop() || "").toLowerCase();
  const isExcel = /xlsx?|xls/.test(ext) || /spreadsheet|excel/.test(mimeType || "");

  if (isExcel) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const workbook = XLSX.read(base64, { type: "base64" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(firstSheet);
    return csv;
  }

  const text = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return text;
}
