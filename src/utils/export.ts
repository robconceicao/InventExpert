import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

export const shareCsvFile = async (
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) => {
  try {
    const headerString = headers.join(",") + "\n";
    const rowString = rows
      .map((row) => row.map((val) => `"${val}"`).join(","))
      .join("\n");
    const csvContent = headerString + rowString;

    // --- TRUQUE PARA ENGANAR O TYPESCRIPT ---
    const fs = FileSystem as any;

    // Agora o TS não vai reclamar de .documentDirectory
    const directory = fs.documentDirectory || fs.cacheDirectory;
    const fileUri = directory + filename;

    await fs.writeAsStringAsync(fileUri, csvContent, {
      encoding: fs.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      Alert.alert("Erro", "Compartilhamento não disponível neste dispositivo.");
    }
  } catch (error) {
    console.error("Erro ao exportar CSV:", error);
    Alert.alert("Erro", "Falha ao gerar o arquivo CSV.");
  }
};
