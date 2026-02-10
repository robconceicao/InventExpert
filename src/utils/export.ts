import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

export const shareCsvFile = async (
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) => {
  try {
    // 1. Criar conteúdo CSV
    const headerString = headers.join(",") + "\n";
    const rowString = rows
      .map((row) => row.map((val) => `"${val}"`).join(","))
      .join("\n");
    const csvContent = headerString + rowString;

    // --- CORREÇÃO DE TIPAGEM (TypeScript) ---
    // Forçamos o 'fs' como any para ignorar os erros que aparecem no seu editor
    const fs = FileSystem as any;

    // 2. Definir caminho (Tenta documentDirectory, se falhar usa cacheDirectory)
    const directory = fs.documentDirectory || fs.cacheDirectory;
    const fileUri = directory + filename;

    // 3. Escrever arquivo
    await fs.writeAsStringAsync(fileUri, csvContent, {
      encoding: fs.EncodingType.UTF8,
    });

    // 4. Compartilhar
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
