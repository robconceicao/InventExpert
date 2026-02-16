import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

export const shareCsvFile = async (
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) => {
  try {
    const headerString = headers.join(";") + "\n";
    const rowString = rows
      .map((row) =>
        row
          .map((val) => {
            const s = String(val ?? "").replace(/"/g, '""');
            return s.includes(";") || s.includes("\n") ? `"${s}"` : s;
          })
          .join(";")
      )
      .join("\n");
    const csvContent = "\uFEFF" + headerString + rowString;

    const directory =
      FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
    const fileUri = directory.replace(/\/?$/, "/") + filename;

    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
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
