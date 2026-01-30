import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
    Alert,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import DocumentScanner from "react-native-document-scanner-plugin";

export default function ScannerScreen() {
  const [scannedImages, setScannedImages] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [pdfName, setPdfName] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const handleScan = async (append = false) => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Indisponível",
        "O scanner automático não está disponível na versão web.",
      );
      return;
    }
    try {
      setIsScanning(true);
      const result = await DocumentScanner.scanDocument({
        maxNumDocuments: 10,
      });
      if (result?.scannedImages?.length) {
        setScannedImages((prev) =>
          append ? [...prev, ...result.scannedImages] : result.scannedImages,
        );
      } else {
        Alert.alert("Aviso", "Nenhuma imagem foi capturada.");
      }
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o scanner.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleClear = () => {
    setScannedImages([]);
  };

  const openShareModal = () => {
    if (scannedImages.length === 0) {
      Alert.alert(
        "Sem imagens",
        "Escaneie ao menos uma página antes de enviar.",
      );
      return;
    }
    const fallbackName = `relatorio_scaneado_${new Date().toISOString().slice(0, 10)}`;
    setPdfName((prev) => (prev.trim().length > 0 ? prev : fallbackName));
    setShareVisible(true);
  };

  const handleSharePdf = async () => {
    const trimmed = pdfName.trim().replace(/[/\\?%*:|"<>]/g, "");
    if (!trimmed) {
      Alert.alert("Nome inválido", "Informe um nome para o arquivo.");
      return;
    }
    try {
      setIsSharing(true);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          "Indisponível",
          "Compartilhamento não disponível neste dispositivo.",
        );
        return;
      }
      const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
      if (!baseDir) {
        Alert.alert(
          "Indisponível",
          "Diretório local indisponível para gerar o PDF.",
        );
        return;
      }

      const imageTags = await Promise.all(
        scannedImages.map(async (uri) => {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return `<img src="data:image/jpeg;base64,${base64}" style="width:100%;page-break-after:always;" />`;
        }),
      );
      const html = `
        <html>
          <body style="margin:0;padding:0;">
            ${imageTags.join("")}
          </body>
        </html>
      `;
      const printed = await Print.printToFileAsync({ html });
      const targetName = trimmed.endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
      const targetUri = `${baseDir}${targetName}`;
      if (targetUri !== printed.uri) {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
        await FileSystem.copyAsync({ from: printed.uri, to: targetUri });
      }

      await Sharing.shareAsync(targetUri, {
        mimeType: "application/pdf",
        dialogTitle: "Enviar PDF escaneado",
        UTI: "com.adobe.pdf",
      });
      setShareVisible(false);
    } catch {
      Alert.alert(
        "Erro",
        "Não foi possível gerar ou compartilhar o PDF. No emulador o compartilhamento pode falhar; teste no dispositivo físico.",
      );
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="px-4 pb-8 pt-4"
    >
      <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <Text className="text-base font-semibold text-slate-800">
          Scanner de Documentos
        </Text>
        <Text className="mt-2 text-sm text-slate-600">
          O scanner detecta automaticamente a folha, recorta o documento e
          aplica ajuste de perspectiva.
        </Text>
        <Pressable
          onPress={() => void handleScan(false)}
          className="mt-3 items-center rounded-lg bg-blue-600 py-2"
          disabled={isScanning}
        >
          <Text className="text-sm font-semibold text-white">
            {isScanning ? "Abrindo scanner..." : "Escanear documentos"}
          </Text>
        </Pressable>
        <View className="mt-2 flex-row gap-2">
          <Pressable
            onPress={() => void handleScan(true)}
            className="flex-1 items-center rounded-lg bg-slate-200 py-2"
            disabled={isScanning}
          >
            <Text className="text-sm font-semibold text-slate-700">
              Adicionar páginas
            </Text>
          </Pressable>
          <Pressable
            onPress={handleClear}
            className="flex-1 items-center rounded-lg bg-rose-600 py-2"
            disabled={isScanning}
          >
            <Text className="text-sm font-semibold text-white">Limpar</Text>
          </Pressable>
        </View>
        <Text className="mt-2 text-xs text-slate-500">
          Captura sequencial: o scanner abre e fecha a câmera por página.
        </Text>
      </View>

      <View className="rounded-xl bg-white p-4 shadow-sm">
        <Text className="text-base font-semibold text-slate-800">
          Pré-visualização
        </Text>
        {scannedImages.length === 0 ? (
          <Text className="mt-3 text-sm text-slate-500">
            Nenhuma imagem capturada.
          </Text>
        ) : (
          <View className="mt-3 flex-col gap-3">
            {scannedImages.map((uri, index) => (
              <View
                key={`${uri}-${index}`}
                className="rounded-lg border border-slate-200 p-2"
              >
                <Text className="text-xs font-semibold text-slate-500">
                  Página {index + 1}
                </Text>
                <Image
                  source={{ uri }}
                  className="mt-2 h-80 w-full rounded-lg"
                  resizeMode="contain"
                />
              </View>
            ))}
          </View>
        )}
      </View>

      <Pressable
        onPress={openShareModal}
        className="mt-4 items-center rounded-xl bg-blue-600 py-3"
        disabled={isSharing}
      >
        <Text className="text-base font-semibold text-white">
          {isSharing ? "Gerando PDF..." : "Enviar PDF escaneado"}
        </Text>
      </Pressable>

      <Modal visible={shareVisible} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/50 px-4">
          <View className="w-full max-w-md rounded-xl bg-white p-4">
            <Text className="text-base font-semibold text-slate-800">
              Nome do arquivo
            </Text>
            <TextInput
              value={pdfName}
              onChangeText={setPdfName}
              placeholder="relatorio_scaneado"
              className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={() => setShareVisible(false)}
                className="flex-1 items-center rounded-lg bg-slate-200 py-2"
              >
                <Text className="text-sm font-semibold text-slate-700">
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handleSharePdf()}
                className="flex-1 items-center rounded-lg bg-blue-600 py-2"
              >
                <Text className="text-sm font-semibold text-white">Enviar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
