import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  type FillingReportId,
  setReportFilling,
} from "../services/advanceAlarmService";
import { enqueueSyncItem, syncQueue } from "../services/sync";
import type { ReportG } from "../types";
import { applyMirrorToReportG } from "../utils/mirrorToReportG";
import { formatTimeInputH, formatTimeNowH } from "../utils/timeFormat";

type SyncKind =
  | "reportA"
  | "reportB"
  | "reportC"
  | "reportD"
  | "reportE"
  | "reportF"
  | "reportG"
  | "reportH"
  | "reportI"
  | "reportJ";

function reportHasContent(report: object): boolean {
  return Object.values(report as Record<string, unknown>).some((v) => {
    if (v === null || v === undefined || v === "") return false;
    if (typeof v === "boolean") return true;
    return String(v).trim().length > 0;
  });
}

type Props<T extends object> = {
  storageKey: string;
  historyKey: string;
  syncKind: SyncKind;
  initialState: T;
  formatPreview: (report: T) => string;
  /** Se definido, espelha campos no ReportG a cada alteração (A–F). */
  mirrorToG?: (report: T) => Partial<ReportG>;
  /** Recarrega do AsyncStorage ao focar a tela (útil no ReportG). */
  reloadOnFocus?: boolean;
  /**
   * Quando definido (A–F), sinaliza preenchimento ativo para o alarme
   * de avanços dos conferentes.
   */
  fillingReportId?: FillingReportId;
  children: (api: {
    report: T;
    setField: <K extends keyof T>(key: K, value: T[K]) => void;
    setTimeNow: (key: keyof T) => void;
    renderTextField: (
      label: string,
      field: keyof T,
      opts?: { numeric?: boolean; placeholder?: string },
    ) => React.ReactNode;
    renderTimeField: (label: string, field: keyof T) => React.ReactNode;
    renderBoolField: (label: string, field: keyof T) => React.ReactNode;
    styles: typeof styles;
  }) => React.ReactNode;
};

export default function ReportFormShell<T extends object>({
  storageKey,
  historyKey,
  syncKind,
  initialState,
  formatPreview,
  mirrorToG,
  reloadOnFocus = false,
  fillingReportId,
  children,
}: Props<T>) {
  const [report, setReport] = useState<T>(initialState);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const initialRef = React.useRef(initialState);
  const mirrorRef = React.useRef(mirrorToG);
  mirrorRef.current = mirrorToG;
  const reportRef = React.useRef(report);
  reportRef.current = report;

  const loadFromStorage = useCallback(() => {
    AsyncStorage.getItem(storageKey).then((res) => {
      if (res) {
        try {
          setReport({ ...initialRef.current, ...JSON.parse(res) });
        } catch {
          /* ignore corrupt cache */
        }
      }
      setHydrated(true);
    });
  }, [storageKey]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useFocusEffect(
    useCallback(() => {
      if (reloadOnFocus) {
        loadFromStorage();
      }
      // Alarme: ao focar A–F, marca preenchimento ativo
      if (fillingReportId) {
        void setReportFilling(fillingReportId, true);
      }
      return () => {
        // Ao sair: mantém ativo só se ainda houver conteúdo no formulário
        if (fillingReportId) {
          const stillFilling = reportHasContent(reportRef.current);
          void setReportFilling(fillingReportId, stillFilling);
        }
      };
    }, [reloadOnFocus, loadFromStorage, fillingReportId]),
  );

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(report)).catch(() => null);
    if (mirrorRef.current) {
      void applyMirrorToReportG(mirrorRef.current(report));
    }
    if (fillingReportId) {
      void setReportFilling(fillingReportId, reportHasContent(report));
    }
  }, [report, storageKey, hydrated, fillingReportId]);

  const setField = <K extends keyof T>(key: K, value: T[K]) => {
    setReport((prev) => ({ ...prev, [key]: value }));
  };

  const setTimeNow = (key: keyof T) => {
    setField(key, formatTimeNowH() as T[keyof T]);
  };

  const renderTextField = (
    label: string,
    field: keyof T,
    opts?: { numeric?: boolean; placeholder?: string },
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={String(report[field] ?? "")}
        onChangeText={(t) => setField(field, t as T[keyof T])}
        placeholder={opts?.placeholder ?? (opts?.numeric ? "0" : "")}
        keyboardType={opts?.numeric ? "numeric" : "default"}
      />
    </View>
  );

  const renderTimeField = (label: string, field: keyof T) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.timeRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={String(report[field] ?? "")}
          onChangeText={(t) => setField(field, formatTimeInputH(t) as T[keyof T])}
          placeholder="00h00"
          keyboardType="numbers-and-punctuation"
        />
        <Pressable onPress={() => setTimeNow(field)} style={styles.nowBtn}>
          <Ionicons name="time-outline" size={20} color="#2563EB" />
        </Pressable>
      </View>
    </View>
  );

  const renderBoolField = (label: string, field: keyof T) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {([true, false] as const).map((v) => (
          <Pressable
            key={String(v)}
            onPress={() => setField(field, v as T[keyof T])}
            style={[styles.radio, report[field] === v && styles.radioSel]}
          >
            <Text style={[styles.radioTxt, report[field] === v && styles.radioTxtSel]}>
              {v ? "Sim" : "Não"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const handleSend = () => {
    const msg = formatPreview(report);
    const waUrl =
      Platform.OS === "web"
        ? `https://wa.me/?text=${encodeURIComponent(msg)}`
        : `whatsapp://send?text=${encodeURIComponent(msg)}`;
    Linking.openURL(waUrl).catch(() =>
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp."),
    );
  };

  const handleArchive = async (clearForm: boolean) => {
    try {
      const stored = await AsyncStorage.getItem(historyKey);
      const history = stored
        ? (JSON.parse(stored) as { savedAt: string; report: T }[])
        : [];
      history.push({ savedAt: new Date().toISOString(), report: { ...report } });
      await AsyncStorage.setItem(historyKey, JSON.stringify(history));
      await enqueueSyncItem(syncKind, { report });
      void syncQueue();
      if (clearForm) {
        setReport(initialState);
        Alert.alert("Arquivado", "Dados salvos e formulário limpo.");
      } else {
        Alert.alert("Arquivado", "Dados salvos com sucesso.");
      }
    } catch {
      Alert.alert("Erro", "Não foi possível arquivar.");
    }
  };

  const handleClearOnly = () => {
    Alert.alert("Limpar Tudo?", "Isso apagará os dados atuais sem salvar.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar",
        style: "destructive",
        onPress: () => setReport(initialState),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {children({
            report,
            setField,
            setTimeNow,
            renderTextField,
            renderTimeField,
            renderBoolField,
            styles,
          })}

          <Pressable style={styles.buttonPrimary} onPress={() => setPreviewVisible(true)}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.btnText}>Gerar Relatório</Text>
          </Pressable>
          <View style={[styles.row, { marginTop: 8, gap: 8 }]}>
            <Pressable style={[styles.buttonClear, { flex: 1 }]} onPress={handleClearOnly}>
              <Text style={styles.btnTextDanger}>Limpar</Text>
            </Pressable>
            <Pressable
              style={[styles.buttonClear, { flex: 1, backgroundColor: "#E2E8F0" }]}
              onPress={() => void handleArchive(true)}
            >
              <Text style={[styles.btnTextDanger, { color: "#334155" }]}>Limpar/Arquivar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={previewVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.sectionTitle}>Pré-visualização</Text>
            <ScrollView style={styles.previewBox}>
              <Text style={styles.previewText}>{formatPreview(report)}</Text>
            </ScrollView>
            <View style={styles.row}>
              <Pressable style={styles.btnBack} onPress={() => setPreviewVisible(false)}>
                <Text>Voltar</Text>
              </Pressable>
              <Pressable style={[styles.buttonPrimary, { flex: 1, marginTop: 0 }]} onPress={handleSend}>
                <Text style={styles.btnText}>Enviar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  section: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1E40AF",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  label: { fontSize: 12, fontWeight: "600", color: "#64748B", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    fontSize: 16,
    color: "#1E293B",
    backgroundColor: "#fff",
  },
  row: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 8 },
  half: { flex: 1 },
  inputGroup: { marginBottom: 4 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nowBtn: {
    padding: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    marginTop: 4,
  },
  radio: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    alignItems: "center",
  },
  radioSel: { backgroundColor: "#EFF6FF", borderColor: "#2563EB" },
  radioTxt: { color: "#64748B", fontWeight: "bold" },
  radioTxtSel: { color: "#2563EB" },
  buttonPrimary: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  buttonClear: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  btnTextDanger: { color: "#DC2626", fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    maxHeight: "80%",
  },
  previewBox: {
    backgroundColor: "#F1F5F9",
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  previewText: { fontSize: 13, lineHeight: 20, color: "#334155" },
  btnBack: {
    flex: 1,
    padding: 14,
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
  },
});
