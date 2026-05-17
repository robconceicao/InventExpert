import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import DocumentScanner from "react-native-document-scanner-plugin";
import { SafeAreaView } from "react-native-safe-area-context";
import { eraseHandwritingWithGemini } from "../services/geminiVision";

// ---------------------------------------------------------------------------
// Helper: converte URI de imagem para base64 com orientação portrait corrigida
// ---------------------------------------------------------------------------
const toPortraitBase64 = async (uri: string): Promise<string> => {
  // Normaliza para JPEG e garante orientação correta via manipulação
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ rotate: 0 }], // força re-encode sem rotação extra
    {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  return manipResult.base64 ?? "";
};

// ---------------------------------------------------------------------------
// Helper (fallback): converte para PNG base64 para uso no HTML/PDF CSS
// ---------------------------------------------------------------------------
const toPngBase64 = async (uri: string): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ rotate: 0 }],
    { compress: 1, format: ImageManipulator.SaveFormat.PNG, base64: true },
  );
  return result.base64 ?? "";
};

// ---------------------------------------------------------------------------
// Helper (fallback CSS): remoção básica de escrita via filtros CSS quando
// o Gemini não está disponível (offline ou erro de API).
// ---------------------------------------------------------------------------
const buildEraserHtmlCss = (base64: string): string => `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page { size: A4 portrait; margin: 0; }
  body { margin:0; padding:0; background:#fff; }
  img { display:block; width:100%; height:auto;
    filter: grayscale(100%) contrast(1.2);
  }
</style></head>
<body><img src="data:image/jpeg;base64,${base64}" /></body></html>`;

export default function ScannerScreen() {
  const [scannedImages, setScannedImages] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [pdfName, setPdfName] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  // Eraser mode
  const [eraserVisible, setEraserVisible] = useState(false);
  const [eraserSource, setEraserSource] = useState<string | null>(null);
  const [eraserResult, setEraserResult] = useState<string | null>(null);
  const [isErasing, setIsErasing] = useState(false);
  const [eraserStatus, setEraserStatus] = useState<string>("");
  const [eraserUsedAI, setEraserUsedAI] = useState(false);

  // ── Escanear documento (portrait: o plugin já orienta corretamente em modo
  //    portrait do dispositivo; forçamos re-encode para garantir metadados EXIF)
  const handleScan = async (append = false) => {
    if (Platform.OS === "web") {
      Alert.alert("Indisponível", "O scanner automático não está disponível na versão web.");
      return;
    }
    try {
      setIsScanning(true);
      const result = await DocumentScanner.scanDocument({ maxNumDocuments: 10 });
      if (result?.scannedImages && result.scannedImages.length > 0) {
        const newImages = result.scannedImages;
        setScannedImages((prev) => (append ? [...prev, ...newImages] : [...newImages]));
      }
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o scanner.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleClear = () => setScannedImages([]);

  const openShareModal = () => {
    if (scannedImages.length === 0) {
      Alert.alert("Sem imagens", "Escaneie ao menos uma página antes de enviar.");
      return;
    }
    const fallbackName = `relatorio_scaneado_${new Date().toISOString().slice(0, 10)}`;
    setPdfName((prev) => (prev.trim().length > 0 ? prev : fallbackName));
    setShareVisible(true);
  };

  // ── Gera PDF com imagens em orientação portrait (página em pé)
  const handleSharePdf = async () => {
    const trimmed = pdfName.trim().replace(/[/\\?%*:|"<>]/g, "");
    if (!trimmed) {
      Alert.alert("Nome inválido", "Informe um nome para o arquivo.");
      return;
    }
    try {
      setIsSharing(true);

      // Converte cada imagem para base64 garantindo portrait
      const imageTags = await Promise.all(
        scannedImages.map(async (uri, idx) => {
          let base64: string;
          try {
            base64 = await toPortraitBase64(uri);
          } catch {
            // fallback: lê diretamente
            base64 = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          }
          const breakStyle = idx < scannedImages.length - 1 ? "page-break-after:always;" : "";
          // CSS: página A4 portrait, imagem ocupa a altura total
          return `<img src="data:image/jpeg;base64,${base64}" style="display:block;width:100%;height:auto;margin:0;padding:0;${breakStyle}" />`;
        }),
      );

      // HTML com meta de orientação portrait
      const html = `<!DOCTYPE html>
<html style="margin:0;padding:0;">
<head>
<meta charset="utf-8"/>
<style>
  @page { size: A4 portrait; margin: 0; }
  body { margin:0; padding:0; }
  img { max-width:100%; object-fit:contain; }
</style>
</head>
<body style="margin:0;padding:0;">${imageTags.join("")}</body>
</html>`;

      const printed = await Print.printToFileAsync({ html });
      const targetName = trimmed.endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
      const outputUri = `${FileSystem.cacheDirectory}${targetName}`;
      await FileSystem.moveAsync({ from: printed.uri, to: outputUri });
      await Sharing.shareAsync(outputUri, {
        mimeType: "application/pdf",
        dialogTitle: "Enviar PDF escaneado",
      });
      setShareVisible(false);
    } catch {
      Alert.alert("Erro", "Falha ao gerar o PDF.");
    } finally {
      setIsSharing(false);
    }
  };

  // ── Abre câmera para foto da folha preenchida e apaga a escrita
  const handleOpenEraser = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permissão negada", "Permita acesso à câmera para usar esta função.");
      return;
    }
    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      quality: 1,
      allowsEditing: false,
      exif: false,
    });
    if (!picked.canceled && picked.assets.length > 0) {
      setEraserSource(picked.assets[0].uri);
      setEraserResult(null);
      setEraserVisible(true);
    }
  };

  const handleEraseHandwriting = async () => {
    if (!eraserSource) return;
    setEraserUsedAI(false);
    try {
      setIsErasing(true);

      // ── Passo 1: converte foto para JPEG base64 em alta resolução
      setEraserStatus("Preparando imagem...");
      const jpegResult = await ImageManipulator.manipulateAsync(
        eraserSource,
        [{ rotate: 0 }],
        { compress: 0.50, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const jpegBase64 = jpegResult.base64 ?? "";

      let finalPdfUri: string;

      // ── Passo 2: tenta a IA (Gemini Vision) para recriar o formulário
      setEraserStatus("Apagando escrita e adaptando...");
      const geminiResult = await eraseHandwritingWithGemini(jpegBase64, "image/jpeg");

      if (geminiResult.success) {
        // ── Gemini retornou o HTML do formulário limpo
        setEraserStatus("Gerando PDF Digital...");
        setEraserUsedAI(true);
        const html = geminiResult.html;

        const printed = await Print.printToFileAsync({ html });
        finalPdfUri = `${FileSystem.cacheDirectory}folha_limpa_gemini_${Date.now()}.pdf`;
        await FileSystem.moveAsync({ from: printed.uri, to: finalPdfUri });

      } else {
        // ── Fallback: IA falhou, usa filtros CSS locais
        console.warn("[Scanner] Gemini falhou, usando fallback CSS:", geminiResult.error);
        
        // Exibe um alerta de debug temporário para descobrirmos o erro exato retornado pelo Google
        Alert.alert(
          "Debug: Novo Erro da IA",
          `O Gemini retornou o seguinte erro:\n\n${geminiResult.error}\n\nO app usará o filtro preto e branco reserva.`,
          [{ text: "OK" }]
        );

        setEraserStatus("Apagando escrita e adaptando...");

        // Usa o jpegBase64 já compactado em vez de PNG gigante para evitar crash no WebView
        const html = buildEraserHtmlCss(jpegBase64);

        const printed = await Print.printToFileAsync({ html });
        finalPdfUri = `${FileSystem.cacheDirectory}folha_limpa_css_${Date.now()}.pdf`;
        await FileSystem.moveAsync({ from: printed.uri, to: finalPdfUri });
      }

      setEraserResult(finalPdfUri);
      setEraserStatus("");

    } catch (e) {
      console.error("[Scanner] Erro no apagador:", e);
      setEraserStatus("");
      Alert.alert("Erro", "Não foi possível processar a imagem. Tente novamente.");
    } finally {
      setIsErasing(false);
    }
  };

  const handleShareEraserResult = async () => {
    if (!eraserResult) return;
    await Sharing.shareAsync(eraserResult, {
      mimeType: "application/pdf",
      dialogTitle: "Enviar folha limpa",
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Card Scanner */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scanner de Documentos</Text>
          <Text style={styles.subtitle}>
            Capture relatórios físicos e envie como PDF via WhatsApp.{"\n"}
            As páginas são geradas em modo retrato (cabeçalho para cima).
          </Text>

          <Pressable
            style={[styles.buttonPrimary, isScanning && styles.buttonDisabled]}
            onPress={() => void handleScan(false)}
            disabled={isScanning}
          >
            <Ionicons name="scan-outline" size={24} color="#fff" />
            <Text style={styles.buttonText}>
              {isScanning ? "Scanner Aberto..." : "Escanear Documento"}
            </Text>
          </Pressable>

          <View style={styles.row}>
            <Pressable
              style={styles.buttonSecondary}
              onPress={() => void handleScan(true)}
              disabled={isScanning}
            >
              <Text style={styles.buttonTextSecondary}>+ Adicionar Páginas</Text>
            </Pressable>
            <Pressable style={styles.buttonDanger} onPress={handleClear} disabled={isScanning}>
              <Text style={styles.buttonText}>Limpar</Text>
            </Pressable>
          </View>
        </View>

        {/* Card Apagar Escrita */}
        <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: "#7C3AED" }]}>
          <Text style={[styles.cardTitle, { color: "#7C3AED" }]}>Apagar Escrita da Folha</Text>
          <Text style={styles.subtitle}>
            Tire uma foto da folha com campos preenchidos à mão. O sistema
            remove a escrita e gera o PDF como se estivesse em branco.
          </Text>
          <Pressable style={styles.buttonEraser} onPress={() => void handleOpenEraser()}>
            <Ionicons name="camera-outline" size={22} color="#7C3AED" />
            <Text style={styles.buttonTextEraser}>Fotografar Folha Preenchida</Text>
          </Pressable>
        </View>

        {/* Páginas escaneadas */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Páginas Escaneadas ({scannedImages.length})</Text>
          {scannedImages.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma página capturada.</Text>
          ) : (
            scannedImages.map((uri, index) => (
              <View key={index} style={styles.imagePreview}>
                <Text style={styles.pageLabel}>Página {index + 1}</Text>
                <Image source={{ uri }} style={styles.image} resizeMode="contain" />
              </View>
            ))
          )}
        </View>

        <Pressable
          style={[styles.buttonSend, scannedImages.length === 0 && styles.buttonDisabled]}
          onPress={openShareModal}
          disabled={scannedImages.length === 0 || isSharing}
        >
          {isSharing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Gerar e Compartilhar PDF</Text>
          )}
        </Pressable>
      </ScrollView>

      {/* Modal: nome do PDF */}
      <Modal visible={shareVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.cardTitle}>Nome do PDF</Text>
            <TextInput
              value={pdfName}
              onChangeText={setPdfName}
              placeholder="Ex: relatorio_inventario"
              style={styles.input}
            />
            <View style={styles.row}>
              <Pressable style={styles.btnModalBack} onPress={() => setShareVisible(false)}>
                <Text style={styles.btnModalBackText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.btnModalSend} onPress={() => void handleSharePdf()}>
                <Text style={styles.buttonText}>Enviar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: apagar escrita */}
      <Modal visible={eraserVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "92%" }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              {/* Título */}
            <View style={styles.eraserHeader}>
              <Ionicons name="color-wand-outline" size={20} color="#7C3AED" />
              <Text style={[styles.cardTitle, { color: "#7C3AED", marginBottom: 0, flex: 1 }]}>
                Apagar Escrita
              </Text>
              {eraserUsedAI && (
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>✨ Gemini AI</Text>
                </View>
              )}
            </View>

            {/* Preview da foto capturada */}
            {eraserSource && (
              <Image
                source={{ uri: eraserSource }}
                style={styles.eraserPreview}
                resizeMode="contain"
              />
            )}

            {/* Status de progresso da IA */}
            {eraserStatus !== "" && (
              <View style={styles.statusBox}>
                <ActivityIndicator size="small" color="#7C3AED" />
                <Text style={styles.statusText}>{eraserStatus}</Text>
              </View>
            )}

            {/* Botão principal */}
            <Pressable
              style={[styles.buttonPrimary, { backgroundColor: "#7C3AED", marginTop: 12 }]}
              onPress={() => void handleEraseHandwriting()}
              disabled={isErasing}
            >
              {isErasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={20} color="#fff" />
                  <Text style={styles.buttonText}>
                    {eraserResult ? "Reprocessar" : "Apagar Escrita"}
                  </Text>
                </>
              )}
            </Pressable>

            {/* Resultado disponível */}
            {eraserResult && (
              <>
                <View style={[styles.resultBanner, { backgroundColor: "#F8FAFC" }]}>
                  <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                  <Text style={[styles.resultBannerText, { color: "#1E3A8A", fontWeight: "bold" }]}>
                    Processado com sucesso
                  </Text>
                </View>
                <Pressable
                  style={[styles.buttonPrimary, { backgroundColor: "#16A34A", marginTop: 8 }]}
                  onPress={() => void handleShareEraserResult()}
                >
                  <Ionicons name="share-social-outline" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Compartilhar PDF Limpo</Text>
                </Pressable>
              </>
            )}

            {/* Voltar */}
            <Pressable
              style={[styles.btnModalBack, { marginTop: 12, paddingVertical: 12 }]}
              onPress={() => {
                setEraserVisible(false);
                setEraserSource(null);
                setEraserResult(null);
                setEraserStatus("");
                setEraserUsedAI(false);
              }}
            >
              <Text style={[styles.btnModalBackText, { textAlign: "center", fontSize: 16, fontWeight: "bold" }]}>Voltar</Text>
            </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E40AF",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  subtitle: { fontSize: 13, color: "#64748B", marginBottom: 16 },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  buttonPrimary: {
    backgroundColor: "#2563EB",
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  buttonSecondary: {
    flex: 2,
    borderWidth: 1,
    borderColor: "#2563EB",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDanger: {
    flex: 1,
    backgroundColor: "#DC2626",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonEraser: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: "#7C3AED",
    borderStyle: "dashed",
    padding: 14,
    borderRadius: 12,
  },
  buttonSend: {
    backgroundColor: "#16A34A",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  buttonTextSecondary: { color: "#2563EB", fontWeight: "bold" },
  buttonTextEraser: { color: "#7C3AED", fontWeight: "bold", fontSize: 15 },
  imagePreview: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  pageLabel: { fontSize: 12, color: "#94A3B8", marginBottom: 5 },
  image: { width: "100%", height: 350, borderRadius: 8 },
  eraserPreview: { width: "100%", height: 260, borderRadius: 8, marginTop: 8 },
  emptyText: { textAlign: "center", color: "#94A3B8", marginVertical: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: { backgroundColor: "#fff", borderRadius: 20, padding: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    marginVertical: 20,
    fontSize: 16,
  },
  btnModalBack: { flex: 1, padding: 14, alignItems: "center" },
  btnModalBackText: { color: "#64748B", fontWeight: "bold" },
  btnModalSend: {
    flex: 2,
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  // ── Eraser / AI styles ────────────────────────────────────────────────────
  eraserHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  aiBadge: {
    backgroundColor: "#EDE9FE",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#7C3AED",
  },
  aiBadgeText: {
    color: "#7C3AED",
    fontSize: 11,
    fontWeight: "bold",
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F5F3FF",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  statusText: {
    color: "#5B21B6",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  resultBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  resultBannerText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
});
