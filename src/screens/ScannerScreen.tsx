import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
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

      // Correção TypeScript: Verifica se existem imagens antes de atualizar o estado
      if (result && result.scannedImages && result.scannedImages.length > 0) {
        const newImages = result.scannedImages;
        setScannedImages((prev) => {
          return append ? [...prev, ...newImages] : [...newImages];
        });
      }
    } catch (error) {
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
      const imageTags = await Promise.all(
        scannedImages.map(async (uri) => {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return `<img src="data:image/jpeg;base64,${base64}" style="width:100%;page-break-after:always;" />`;
        }),
      );

      const html = `<html><body style="margin:0;padding:0;">${imageTags.join("")}</body></html>`;
      const printed = await Print.printToFileAsync({ html });

      const targetName = trimmed.endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
      const outputUri = `${FileSystem.cacheDirectory}${targetName}`;

      await FileSystem.moveAsync({ from: printed.uri, to: outputUri });

      await Sharing.shareAsync(outputUri, {
        mimeType: "application/pdf",
        dialogTitle: "Enviar PDF escaneado",
      });
      setShareVisible(false);
    } catch (error) {
      Alert.alert("Erro", "Falha ao gerar o PDF.");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scanner de Documentos</Text>
          <Text style={styles.subtitle}>
            Capture relatórios físicos e envie como PDF via WhatsApp.
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
              <Text style={styles.buttonTextSecondary}>
                + Adicionar Páginas
              </Text>
            </Pressable>
            <Pressable
              style={styles.buttonDanger}
              onPress={handleClear}
              disabled={isScanning}
            >
              <Text style={styles.buttonText}>Limpar</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Páginas Escaneadas ({scannedImages.length})
          </Text>
          {scannedImages.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma página capturada.</Text>
          ) : (
            scannedImages.map((uri, index) => (
              <View key={index} style={styles.imagePreview}>
                <Text style={styles.pageLabel}>Página {index + 1}</Text>
                <Image
                  source={{ uri }}
                  style={styles.image}
                  resizeMode="contain"
                />
              </View>
            ))
          )}
        </View>

        <Pressable
          style={[
            styles.buttonSend,
            scannedImages.length === 0 && styles.buttonDisabled,
          ]}
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
              <Pressable
                style={styles.btnModalBack}
                onPress={() => setShareVisible(false)}
              >
                <Text style={styles.btnModalBackText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.btnModalSend}
                onPress={() => void handleSharePdf()}
              >
                <Text style={styles.buttonText}>Enviar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
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
  buttonSend: {
    backgroundColor: "#16A34A",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  buttonTextSecondary: { color: "#2563EB", fontWeight: "bold" },
  imagePreview: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  pageLabel: { fontSize: 12, color: "#94A3B8", marginBottom: 5 },
  image: { width: "100%", height: 350, borderRadius: 8 },
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
});
