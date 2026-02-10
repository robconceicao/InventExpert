import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { enqueueSyncItem, syncQueue } from "../services/sync";
import type { AttendanceCollaborator, AttendanceData } from "../types";
import { shareCsvFile } from "../utils/export";
import {
  formatAttendanceMessage,
  formatDateInput,
  parseWhatsAppScale,
} from "../utils/parsers";

// --- CAMINHO ATUALIZADO ---
const HeaderIcon = require("../../assets/images/splash-icon.png");
const STORAGE_KEY = "inventexpert:attendance";
const HISTORY_KEY = "inventexpert:attendance:history";

const emptyData: AttendanceData = {
  data: "",
  loja: "",
  enderecoLoja: "",
  colaboradores: [],
};

export default function AttendanceScreen() {
  const navigation = useNavigation();
  const [rawText, setRawText] = useState("");
  const [attendance, setAttendance] = useState<AttendanceData>(emptyData);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Remove cabeçalho duplicado
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const loadData = async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AttendanceData;
        setAttendance({
          data: parsed.data ?? "",
          loja: parsed.loja ?? "",
          enderecoLoja: parsed.enderecoLoja ?? "",
          colaboradores: (parsed.colaboradores ?? []).map((item) => {
            const legacy = item as AttendanceCollaborator & {
              presente?: boolean;
            };
            return {
              ...item,
              status:
                legacy.status ??
                (legacy.presente ? "PRESENTE" : "NAO_DEFINIDO"),
              substituto: legacy.substituto ?? "",
            };
          }),
        });
      }
    };
    void loadData();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(attendance)).catch(
      () => null,
    );
  }, [attendance]);

  const handleParse = () => {
    const parsed = parseWhatsAppScale(rawText);
    setAttendance(parsed);
    Alert.alert("Sucesso", "Texto processado. Verifique os campos abaixo.");
  };

  const togglePresence = (
    collaborator: AttendanceCollaborator,
    status: AttendanceCollaborator["status"],
  ) => {
    setAttendance((prev) => ({
      ...prev,
      colaboradores: prev.colaboradores.map((item) =>
        item.id === collaborator.id ? { ...item, status } : item,
      ),
    }));
  };

  const previewMessage = useMemo(
    () => formatAttendanceMessage(attendance),
    [attendance],
  );

  const handleOpenPreview = () => {
    if (!attendance.data.trim() || !attendance.loja.trim()) {
      Alert.alert(
        "Campos obrigatórios",
        "Preencha Data e Loja antes de enviar.",
      );
      return;
    }
    setPreviewVisible(true);
  };

  const handleSendWhatsApp = () => {
    const url = `whatsapp://send?text=${encodeURIComponent(previewMessage)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp.");
    });
  };

  const handleArchiveAndClear = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem(HISTORY_KEY);
      const history = storedHistory
        ? (JSON.parse(storedHistory) as Array<Record<string, unknown>>)
        : [];
      history.push({
        savedAt: new Date().toISOString(),
        attendance,
      });
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      await enqueueSyncItem("attendance", { attendance });
    } catch {
      Alert.alert("Erro", "Não foi possível arquivar os dados.");
      return;
    }

    await handleExportHistory();
    void syncQueue();

    setRawText("");
    setAttendance(emptyData);
    Alert.alert(
      "Dados arquivados",
      "A escala foi arquivada e o formulário foi limpo.",
    );
  };

  const handleExportHistory = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem(HISTORY_KEY);
      const history = storedHistory
        ? (JSON.parse(storedHistory) as Array<{
            savedAt: string;
            attendance: AttendanceData;
          }>)
        : [];
      if (history.length === 0) {
        Alert.alert("Sem dados", "Não há dados arquivados para exportar.");
        return;
      }
      const headers = [
        "savedAt",
        "data",
        "loja",
        "enderecoLoja",
        "colaboradorNome",
        "status",
        "substituto",
      ];
      const rows = history.flatMap((item) => {
        const base = [
          item.savedAt,
          item.attendance.data,
          item.attendance.loja,
          item.attendance.enderecoLoja,
        ];
        if (
          !item.attendance.colaboradores ||
          item.attendance.colaboradores.length === 0
        ) {
          return [[...base, "", "", ""]];
        }
        return item.attendance.colaboradores.map((collaborator) => [
          ...base,
          collaborator.nome,
          collaborator.status,
          collaborator.substituto ?? "",
        ]);
      });
      const filename = `inventexpert_escala_${new Date().toISOString().slice(0, 10)}.csv`;
      await shareCsvFile(filename, headers, rows);
    } catch {
      Alert.alert(
        "Exportação indisponível",
        "Os dados foram arquivados, mas o compartilhamento não está disponível neste dispositivo.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />
      <View style={styles.header}>
        <Image
          source={HeaderIcon}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>Controle de Escala</Text>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* PARSER WHATSAPP */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Parser de Escala (WhatsApp)</Text>
          <Text style={styles.subtitle}>
            Cole o texto do WhatsApp e clique em processar.
          </Text>
          <TextInput
            value={rawText}
            onChangeText={setRawText}
            multiline
            placeholder="Cole aqui o texto bruto da escala"
            style={styles.textArea}
            textAlignVertical="top"
          />
          <Pressable onPress={handleParse} style={styles.btnProcess}>
            <Text style={styles.btnTextWhite}>Processar escala</Text>
          </Pressable>
        </View>

        {/* DETALHES */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Detalhes da Escala</Text>

          <Text style={styles.label}>Data</Text>
          <TextInput
            value={attendance.data}
            onChangeText={(text) =>
              setAttendance((prev) => ({
                ...prev,
                data: formatDateInput(text),
              }))
            }
            style={styles.input}
          />

          <Text style={styles.label}>Loja</Text>
          <TextInput
            value={attendance.loja}
            onChangeText={(text) =>
              setAttendance((prev) => ({ ...prev, loja: text }))
            }
            style={styles.input}
          />

          <Text style={styles.label}>Endereço da Loja</Text>
          <TextInput
            value={attendance.enderecoLoja}
            onChangeText={(text) =>
              setAttendance((prev) => ({ ...prev, enderecoLoja: text }))
            }
            style={styles.input}
          />
        </View>

        {/* PRESENÇA */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Presença</Text>
          {attendance.colaboradores.length === 0 ? (
            <Text style={styles.subtitle}>
              Nenhum colaborador identificado ainda.
            </Text>
          ) : (
            attendance.colaboradores.map((collaborator) => (
              <View key={collaborator.id} style={styles.collaboratorCard}>
                <Text style={styles.collaboratorName}>{collaborator.nome}</Text>

                <View style={styles.statusRow}>
                  <Pressable
                    onPress={() => togglePresence(collaborator, "PRESENTE")}
                    style={[
                      styles.iconBtn,
                      collaborator.status === "PRESENTE"
                        ? styles.bgEmerald
                        : styles.bgSlate,
                    ]}
                  >
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={
                        collaborator.status === "PRESENTE" ? "#fff" : "#0F172A"
                      }
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => togglePresence(collaborator, "AUSENTE")}
                    style={[
                      styles.iconBtn,
                      collaborator.status === "AUSENTE"
                        ? styles.bgRose
                        : styles.bgSlate,
                    ]}
                  >
                    <Ionicons
                      name="close"
                      size={18}
                      color={
                        collaborator.status === "AUSENTE" ? "#fff" : "#0F172A"
                      }
                    />
                  </Pressable>
                </View>

                <View style={styles.marginTop}>
                  <Text style={styles.subLabel}>Substituição (se houver)</Text>
                  <TextInput
                    value={collaborator.substituto ?? ""}
                    onChangeText={(text) =>
                      setAttendance((prev) => ({
                        ...prev,
                        colaboradores: prev.colaboradores.map((item) =>
                          item.id === collaborator.id
                            ? { ...item, substituto: text }
                            : item,
                        ),
                      }))
                    }
                    placeholder="Nome do substituto"
                    style={styles.input}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        <Pressable onPress={handleOpenPreview} style={styles.btnPrimary}>
          <Text style={styles.btnTextWhite}>Enviar Escala</Text>
        </Pressable>

        <Pressable
          onPress={() =>
            Alert.alert(
              "Arquivar e limpar",
              "Isso limpará a escala, mas os dados ficarão arquivados para análise.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Arquivar",
                  onPress: () => void handleArchiveAndClear(),
                },
              ],
            )
          }
          style={styles.btnSecondary}
        >
          <Text style={styles.btnTextSecondary}>Arquivar e limpar</Text>
        </Pressable>

        <Modal visible={previewVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.cardTitle}>Pré-visualização</Text>
              <ScrollView style={styles.previewScroll}>
                <Text style={styles.previewText}>{previewMessage}</Text>
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setPreviewVisible(false)}
                  style={styles.btnBack}
                >
                  <Text style={styles.btnTextSecondary}>Voltar</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setPreviewVisible(false);
                    handleSendWhatsApp();
                  }}
                  style={styles.btnConfirm}
                >
                  <Text style={styles.btnTextWhite}>Enviar WhatsApp</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    padding: 16,
  },
  headerLogo: { width: 32, height: 32, marginRight: 10, borderRadius: 6 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 16,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#1E293B" },
  subtitle: { marginTop: 8, fontSize: 14, color: "#475569" },
  textArea: {
    marginTop: 12,
    minHeight: 140,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
    padding: 12,
    textAlignVertical: "top",
  },
  btnProcess: {
    marginTop: 12,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#2563EB",
    paddingVertical: 10,
  },
  btnTextWhite: { fontSize: 14, fontWeight: "600", color: "#fff" },
  label: { marginTop: 12, fontSize: 14, fontWeight: "600", color: "#334155" },
  input: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0F172A",
  },
  collaboratorCard: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  collaboratorName: { fontSize: 14, fontWeight: "500", color: "#1E293B" },
  statusRow: { marginTop: 8, flexDirection: "row", gap: 12 },
  iconBtn: {
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  bgEmerald: { backgroundColor: "#059669" },
  bgRose: { backgroundColor: "#E11D48" },
  bgSlate: { backgroundColor: "#E2E8F0" },
  marginTop: { marginTop: 12 },
  subLabel: { fontSize: 12, fontWeight: "600", color: "#475569" },
  btnPrimary: {
    marginTop: 16,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#2563EB",
    paddingVertical: 12,
  },
  btnSecondary: {
    marginTop: 8,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
    paddingVertical: 12,
  },
  btnTextSecondary: { fontSize: 16, fontWeight: "600", color: "#334155" },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 16,
  },
  previewScroll: {
    marginTop: 12,
    maxHeight: 384,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  previewText: { fontSize: 14, color: "#334155" },
  modalActions: { marginTop: 16, flexDirection: "row", gap: 8 },
  btnBack: {
    flex: 1,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    paddingVertical: 10,
  },
  btnConfirm: {
    flex: 1,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#2563EB",
    paddingVertical: 10,
  },
});
