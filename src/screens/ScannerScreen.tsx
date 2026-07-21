import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useCallback, useState } from "react";
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
import ScannerReviewPanel from "../components/ScannerReviewPanel";
import { eraseHandwriting } from "../services/handwritingEraser";
import {
  excluirFolha as excluirFolhaDaLista,
  folhasFromUris,
  inserirDepoisNaLista,
  reescanearFolhaNaLista,
  reordenarFolhas,
  urisOrdenadas,
  type FolhaEscaneada,
} from "../utils/folhaEscaneada";

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

/** Filtra URIs válidos do plugin de scanner. */
function filterScanUris(uris: unknown): string[] {
  if (!Array.isArray(uris)) return [];
  return uris.filter(
    (uri): uri is string => typeof uri === "string" && uri.trim().length > 0,
  );
}

/**
 * Abre a captura de documento.
 * Lib real: react-native-document-scanner-plugin (não expo-camera).
 * maxNumDocuments controla lote vs folha única (reescanear/inserir).
 */
async function abrirCamera(maxNumDocuments = 10): Promise<string[]> {
  if (Platform.OS === "web") {
    Alert.alert("Indisponível", "O scanner automático não está disponível na versão web.");
    return [];
  }
  try {
    const result = await DocumentScanner.scanDocument({ maxNumDocuments });
    return filterScanUris(result?.scannedImages);
  } catch {
    Alert.alert("Erro", "Não foi possível abrir o scanner.");
    return [];
  }
}

export default function ScannerScreen() {
  const [folhas, setFolhas] = useState<FolhaEscaneada[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [pdfName, setPdfName] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  // Revisão pós-scanner (obrigatória antes do PDF)
  const [reviewVisible, setReviewVisible] = useState(false);
  const [revisaoConfirmada, setRevisaoConfirmada] = useState(false);
  const [isReviewCapturing, setIsReviewCapturing] = useState(false);

  // Eraser mode
  const [eraserVisible, setEraserVisible] = useState(false);
  const [eraserSource, setEraserSource] = useState<string | null>(null);
  const [eraserResult, setEraserResult] = useState<string | null>(null);
  const [isErasing, setIsErasing] = useState(false);
  const [eraserStatus, setEraserStatus] = useState<string>("");
  const [eraserUsedAI, setEraserUsedAI] = useState(false);
  const [eraserEngineName, setEraserEngineName] = useState("");
  const [eraserModelName, setEraserModelName] = useState("");

  // ── Escanear documento (portrait: o plugin já orienta corretamente em modo
  //    portrait do dispositivo; forçamos re-encode para garantir metadados EXIF)
  const handleScan = async (append = false) => {
    try {
      setIsScanning(true);
      const newImages = await abrirCamera(10);
      if (newImages.length === 0) return;

      setFolhas((prev) => {
        const novas = folhasFromUris(newImages, append ? prev.length + 1 : 1);
        return append ? [...prev, ...novas] : novas;
      });
      setRevisaoConfirmada(false);
      setReviewVisible(true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleClear = () => {
    setFolhas([]);
    setRevisaoConfirmada(false);
    setReviewVisible(false);
  };

  // ── Ações da revisão (id estável; nunca índice) ──────────────────────────
  const excluirFolha = useCallback((id: string) => {
    setFolhas((prev) => excluirFolhaDaLista(prev, id));
    setRevisaoConfirmada(false);
  }, []);

  const reescanearFolha = useCallback(async (id: string) => {
    setIsReviewCapturing(true);
    try {
      const uris = await abrirCamera(1);
      if (uris.length === 0) return;
      setFolhas((prev) => reescanearFolhaNaLista(prev, id, uris[0]));
      setRevisaoConfirmada(false);
    } finally {
      setIsReviewCapturing(false);
    }
  }, []);

  const inserirDepois = useCallback(async (idReferencia: string) => {
    setIsReviewCapturing(true);
    try {
      const uris = await abrirCamera(1);
      if (uris.length === 0) return;
      setFolhas((prev) => inserirDepoisNaLista(prev, idReferencia, uris[0]));
      setRevisaoConfirmada(false);
    } finally {
      setIsReviewCapturing(false);
    }
  }, []);

  const reordenar = useCallback((novaLista: FolhaEscaneada[]) => {
    setFolhas(reordenarFolhas(novaLista));
    setRevisaoConfirmada(false);
  }, []);

  const confirmarRevisao = useCallback(() => {
    if (folhas.length === 0) {
      Alert.alert("Sem folhas", "Mantenha ao menos uma folha ou cancele a revisão.");
      return;
    }
    setRevisaoConfirmada(true);
    setReviewVisible(false);
  }, [folhas.length]);

  const openShareModal = () => {
    if (folhas.length === 0) {
      Alert.alert("Sem imagens", "Escaneie ao menos uma página antes de enviar.");
      return;
    }
    if (!revisaoConfirmada) {
      Alert.alert(
        "Revisão pendente",
        "Revise as folhas capturadas e confirme a lista antes de gerar o PDF.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Revisar agora", onPress: () => setReviewVisible(true) },
        ],
      );
      return;
    }
    const fallbackName = `relatorio_scaneado_${new Date().toISOString().slice(0, 10)}`;
    setPdfName((prev) => (prev.trim().length > 0 ? prev : fallbackName));
    setShareVisible(true);
  };

  // ── Gera PDF com imagens em orientação portrait (página em pé)
  //    Uma imagem = uma página A4, sem páginas em branco entre elas.
  //    Usa page-break-before nas páginas seguintes (não page-break-after no
  //    último bloco), o que evita a página em branco extra comum no WebKit.
  const handleSharePdf = async () => {
    const trimmed = pdfName.trim().replace(/[/\\?%*:|"<>]/g, "");
    if (!trimmed) {
      Alert.alert("Nome inválido", "Informe um nome para o arquivo.");
      return;
    }
    // Lista final = exatamente o que o usuário revisou (ordem + exclusões)
    const validUris = urisOrdenadas(folhas).filter(
      (uri) => typeof uri === "string" && uri.trim().length > 0,
    );
    if (validUris.length === 0) {
      Alert.alert("Sem imagens", "Escaneie ao menos uma página antes de enviar.");
      return;
    }
    if (!revisaoConfirmada) {
      Alert.alert("Revisão pendente", "Confirme a revisão das folhas antes de processar.");
      return;
    }
    try {
      setIsSharing(true);

      const pageBlocks = await Promise.all(
        validUris.map(async (uri, idx) => {
          let base64: string;
          try {
            base64 = await toPortraitBase64(uri);
          } catch {
            base64 = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          }
          if (!base64) return "";
          // Quebra ANTES da página (exceto a 1ª) — evita blank page trailing/extra
          const pageBreak =
            idx > 0
              ? "page-break-before:always;break-before:page;"
              : "page-break-before:auto;break-before:auto;";
          return `<div class="page" style="${pageBreak}">
  <img src="data:image/jpeg;base64,${base64}" alt="pagina-${idx + 1}" />
</div>`;
        }),
      );

      const pagesHtml = pageBlocks.filter(Boolean).join("\n");

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { size: A4 portrait; margin: 0; }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    background: #fff;
  }
  .page {
    width: 210mm;
    max-width: 100%;
    min-height: 0;
    max-height: 297mm;
    margin: 0;
    padding: 0;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
    box-sizing: border-box;
    display: block;
  }
  .page img {
    display: block;
    width: 100%;
    max-width: 210mm;
    max-height: 297mm;
    height: auto;
    margin: 0;
    padding: 0;
    border: 0;
    object-fit: contain;
    object-position: top center;
  }
</style>
</head>
<body>${pagesHtml}</body>
</html>`;

      const printed = await Print.printToFileAsync({
        html,
        width: 595, // A4 @ 72dpi
        height: 842,
      });
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
    setEraserEngineName("");
    setEraserModelName("");
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

      // ── Passo 2: tenta a IA (Gemini Vision / Outras / Híbrida)
      setEraserStatus("Apagando escrita e adaptando...");
      const result = await eraseHandwriting(jpegBase64, "image/jpeg");

      if (result.success) {
        setEraserStatus("Gerando PDF Digital...");
        setEraserUsedAI(true);
        setEraserEngineName(result.engine);
        setEraserModelName(result.model);
        const html = result.html;

        const printed = await Print.printToFileAsync({ html });
        finalPdfUri = `${FileSystem.cacheDirectory}folha_limpa_${Date.now()}.pdf`;
        await FileSystem.moveAsync({ from: printed.uri, to: finalPdfUri });
        setEraserResult(finalPdfUri);
      } else {
        setEraserUsedAI(false);
        setEraserResult(null);
        // Exibe erro completo detalhando quais APIs falharam
        Alert.alert(
          "Falha no Processamento",
          result.error,
          [{ text: "OK" }],
        );
      }
      setEraserStatus("");
    } catch (e: unknown) {
      console.error("[Scanner] Erro no apagador:", e);
      setEraserStatus("");
      setEraserUsedAI(false);
      setEraserResult(null);
      Alert.alert("Erro", "Ocorreu um erro inesperado ao processar a imagem. Tente novamente.");
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

  const podeGerarPdf = folhas.length > 0 && revisaoConfirmada && !isSharing;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Card Scanner */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scanner de Documentos</Text>
          <Text style={styles.subtitle}>
            Capture relatórios físicos e envie como PDF via WhatsApp.{"\n"}
            As páginas são geradas em modo retrato (cabeçalho para cima).{"\n"}
            Após escanear, revise as folhas antes de processar.
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

        {/* Páginas escaneadas (resumo compacto após revisão) */}
        <View style={styles.card}>
          <View style={styles.pagesHeader}>
            <Text style={[styles.cardTitle, { marginBottom: 0, flex: 1 }]}>
              Páginas Escaneadas ({folhas.length})
            </Text>
            {folhas.length > 0 ? (
              <Pressable
                style={styles.btnRevisar}
                onPress={() => setReviewVisible(true)}
              >
                <Ionicons name="create-outline" size={16} color="#2563EB" />
                <Text style={styles.btnRevisarText}>Revisar lote</Text>
              </Pressable>
            ) : null}
          </View>

          {revisaoConfirmada && folhas.length > 0 ? (
            <View style={styles.confirmBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
              <Text style={styles.confirmBannerText}>
                Lista confirmada — pronta para gerar PDF
              </Text>
            </View>
          ) : folhas.length > 0 ? (
            <View style={styles.pendingBanner}>
              <Ionicons name="alert-circle-outline" size={16} color="#D97706" />
              <Text style={styles.pendingBannerText}>
                Revisão pendente — confirme a lista antes do PDF
              </Text>
            </View>
          ) : null}

          {folhas.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma página capturada.</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbStrip}
            >
              {folhas.map((folha) => (
                <Pressable
                  key={folha.id}
                  style={styles.thumbCard}
                  onPress={() => setReviewVisible(true)}
                >
                  <View style={styles.thumbOrder}>
                    <Text style={styles.thumbOrderText}>{folha.ordem}</Text>
                  </View>
                  <Image
                    source={{ uri: folha.uri }}
                    style={styles.thumbImage}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <Pressable
          style={[styles.buttonSend, !podeGerarPdf && styles.buttonDisabled]}
          onPress={openShareModal}
          disabled={!podeGerarPdf}
        >
          {isSharing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Gerar e Compartilhar PDF</Text>
          )}
        </Pressable>
      </ScrollView>

      {/* Modal: revisão pós-scanner */}
      <Modal
        visible={reviewVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setReviewVisible(false)}
      >
        <View style={styles.reviewSafe}>
          <ScannerReviewPanel
            folhas={folhas}
            isBusy={isReviewCapturing}
            onExcluir={excluirFolha}
            onReescanear={(id) => void reescanearFolha(id)}
            onInserirDepois={(id) => void inserirDepois(id)}
            onReordenar={reordenar}
            onConfirmar={confirmarRevisao}
            onCancelar={() => setReviewVisible(false)}
          />
        </View>
      </Modal>

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
                {eraserUsedAI && eraserEngineName ? (
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>✨ {eraserEngineName}</Text>
                  </View>
                ) : null}
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
                  <View style={styles.resultBanner}>
                    <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                    <Text style={styles.resultBannerText}>
                      Processado com {eraserEngineName || "IA"} ({eraserModelName || "modelo"})
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
  reviewSafe: { flex: 1, backgroundColor: "#F1F5F9" },
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
  pagesHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  btnRevisar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#2563EB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnRevisarText: { color: "#2563EB", fontWeight: "bold", fontSize: 13 },
  confirmBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  confirmBannerText: { color: "#166534", fontSize: 12, fontWeight: "600", flex: 1 },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  pendingBannerText: { color: "#92400E", fontSize: 12, fontWeight: "600", flex: 1 },
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
  thumbStrip: {
    gap: 10,
    paddingVertical: 4,
  },
  thumbCard: {
    width: 96,
    height: 128,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  thumbOrder: {
    position: "absolute",
    top: 6,
    left: 6,
    zIndex: 1,
    minWidth: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  thumbOrderText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
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
