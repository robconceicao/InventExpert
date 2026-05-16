import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

// ---- Web helper: trigger browser download ----
const downloadOnWeb = (filename: string, content: string, mimeType: string) => {
  const bom = "\uFEFF";
  const blob = new Blob([bom + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** Compartilha um arquivo de texto (ex.: relatório gerencial .txt) */
export const shareTextFile = async (
  filename: string,
  content: string,
  dialogTitle = "Exportar relatório"
) => {
  if (Platform.OS === "web") {
    downloadOnWeb(filename, content, "text/plain;charset=utf-8");
    return;
  }
  try {
    const directory =
      FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
    const fileUri = directory.replace(/\/?$/, "/") + filename;
    await FileSystem.writeAsStringAsync(fileUri, "\uFEFF" + content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/plain",
        dialogTitle,
      });
    } else {
      Alert.alert("Erro", "Compartilhamento não disponível neste dispositivo.");
    }
  } catch (error) {
    console.error("Erro ao exportar texto:", error);
    Alert.alert("Erro", "Falha ao gerar o arquivo.");
  }
};

export const shareCsvFile = async (
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) => {
  const headerString = headers.join(";") + "\n";
  const rowString = rows
    .map((row) =>
      row
        .map((val) => {
          const s = String(val ?? "").replace(/"/g, '""');
          return s.includes(";") || s.includes("\n") ? `"${s}"` : s;
        })
        .join(";"),
    )
    .join("\n");
  const csvContent = headerString + rowString;

  if (Platform.OS === "web") {
    downloadOnWeb(filename, csvContent, "text/csv;charset=utf-8");
    return;
  }

  try {
    const directory =
      FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
    const fileUri = directory.replace(/\/?$/, "/") + filename;

    await FileSystem.writeAsStringAsync(fileUri, "\uFEFF" + csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Exportar CSV",
      });
    } else {
      Alert.alert("Erro", "Compartilhamento não disponível neste dispositivo.");
    }
  } catch (error) {
    console.error("Erro ao exportar CSV:", error);
    Alert.alert("Erro", "Falha ao gerar o arquivo CSV.");
  }
};
