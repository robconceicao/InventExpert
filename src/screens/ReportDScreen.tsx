import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Linking,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { enqueueSyncItem, syncQueue } from "../services/sync";
import type { ReportD } from "../types";
import { formatReportD } from "../utils/parsers";

const STORAGE_KEY = "inventexpert:reportD";
const HISTORY_KEY = "inventexpert:reportD:history";

const initialState: ReportD = {
  loja: "",
  lojaNum: "",
  lider: "",
  qtdPessoas: "",
  qtdPecas: "",
  pctInv: "",
  chegada: "",
  inicioContagemEstoque: "",
  terminoContagemEstoque: "",
  inicioContagemLoja: "",
  terminoContagemLoja: "",
  inicioAuditoria: "",
  terminoAuditoria: "",
  inicioDivergencia: "",
  terminoDivergencia: "",
  avalEstoque: "",
  avalLoja: "",
  terminoInventario: "",
};

export default function ReportDScreen() {
  const [report, setReport] = useState<ReportD>(initialState);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((res) => {
      if (res) setReport(JSON.parse(res));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(report)).catch(() => null);
  }, [report]);

  const setField = <K extends keyof ReportD>(key: K, value: ReportD[K]) => {
    setReport((prev) => ({ ...prev, [key]: value }));
  };

  const setTimeNow = (key: keyof ReportD) => {
    const now = new Date();
    const time = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setField(key, time);
  };

  const renderTimeField = (label: string, field: keyof ReportD) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.timeRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={String(report[field])}
          onChangeText={(t) => setField(field, t)}
          placeholder="00:00"
          keyboardType="numbers-and-punctuation"
        />
        <Pressable onPress={() => setTimeNow(field)} style={styles.nowBtn}>
          <Ionicons name="time-outline" size={20} color="#2563EB" />
        </Pressable>
      </View>
    </View>
  );

  const handleSend = () => {
    const msg = formatReportD(report);
    const waUrl =
      Platform.OS === "web"
        ? `https://wa.me/?text=${encodeURIComponent(msg)}`
        : `whatsapp://send?text=${encodeURIComponent(msg)}`;
    Linking.openURL(waUrl);
  };

  const handleArchive = async (clearForm: boolean) => {
    try {
      const stored = await AsyncStorage.getItem(HISTORY_KEY);
      const history = stored
        ? (JSON.parse(stored) as { savedAt: string; report: ReportD }[])
        : [];
      history.push({
        savedAt: new Date().toISOString(),
        report: { ...report },
      });
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      await enqueueSyncItem("reportD", { report });
      void syncQueue();
      if (clearForm) {
        setReport(initialState);
        Alert.alert("Arquivado", "Dados salvos e formul├írio limpo.");
      } else {
        Alert.alert("Arquivado", "Dados salvos com sucesso.");
      }
    } catch {
      Alert.alert("Erro", "N├úo foi poss├¡vel arquivar.");
    }
  };

  const handleClearOnly = () => {
    Alert.alert("Limpar Tudo?", "Isso apagar├í os dados atuais sem salvar.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar",
        style: "destructive",
        onPress: () => setReport(initialState),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Identifica├º├úo</Text>
            <Text style={styles.label}>Loja</Text>
            <TextInput style={styles.input} value={report.loja} onChangeText={(t) => setField("loja", t)} />
            <View style={styles.row}>
                <View style={styles.half}>
                    <Text style={styles.label}>N┬║ Loja</Text>
                    <TextInput style={styles.input} value={report.lojaNum} onChangeText={(t) => setField("lojaNum", t)} keyboardType="numeric" />
                </View>
                <View style={styles.half}>
                    <Text style={styles.label}>L├¡der</Text>
                    <TextInput style={styles.input} value={report.lider} onChangeText={(t) => setField("lider", t)} />
                </View>
            </View>
            <View style={styles.row}>
                <View style={styles.half}>
                    <Text style={styles.label}>Qtd. Pessoas</Text>
                    <TextInput style={styles.input} value={String(report.qtdPessoas)} onChangeText={(t) => setField("qtdPessoas", t === "" ? "" : Number(t))} keyboardType="numeric" />
                </View>
                <View style={styles.half}>
                    <Text style={styles.label}>Qtd. Pe├ºas</Text>
                    <TextInput style={styles.input} value={String(report.qtdPecas)} onChangeText={(t) => setField("qtdPecas", t === "" ? "" : Number(t))} keyboardType="numeric" />
                </View>
            </View>
            <Text style={styles.label}>% Inv.</Text>
            <TextInput style={styles.input} value={String(report.pctInv)} onChangeText={(t) => setField("pctInv", t === "" ? "" : Number(t))} keyboardType="numeric" placeholder="%" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Cronograma</Text>
            {renderTimeField("Chegada", "chegada")}
            <View style={styles.row}>
                <View style={styles.half}>
                    {renderTimeField("Ini. Cont. Est.", "inicioContagemEstoque")}
                </View>
                <View style={styles.half}>
                    {renderTimeField("Fim Cont. Est.", "terminoContagemEstoque")}
                </View>
            </View>
            <View style={styles.row}>
                <View style={styles.half}>
                    {renderTimeField("Ini. Cont. Loja", "inicioContagemLoja")}
                </View>
                <View style={styles.half}>
                    {renderTimeField("Fim Cont. Loja", "terminoContagemLoja")}
                </View>
            </View>
            <View style={styles.row}>
                <View style={styles.half}>
                    {renderTimeField("Ini. Audit.", "inicioAuditoria")}
                </View>
                <View style={styles.half}>
                    {renderTimeField("Fim Audit.", "terminoAuditoria")}
                </View>
            </View>
            <View style={styles.row}>
                <View style={styles.half}>
                    {renderTimeField("Ini. Diverg.", "inicioDivergencia")}
                </View>
                <View style={styles.half}>
                    {renderTimeField("Fim Diverg.", "terminoDivergencia")}
                </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Avalia├º├úo e Fim</Text>
            <View style={styles.row}>
                <View style={styles.half}>
                    <Text style={styles.label}>Aval. Est. (%)</Text>
                    <TextInput style={styles.input} value={String(report.avalEstoque)} onChangeText={(t) => setField("avalEstoque", t === "" ? "" : Number(t))} keyboardType="numeric" />
                </View>
                <View style={styles.half}>
                    <Text style={styles.label}>Aval. Loja (%)</Text>
                    <TextInput style={styles.input} value={String(report.avalLoja)} onChangeText={(t) => setField("avalLoja", t === "" ? "" : Number(t))} keyboardType="numeric" />
                </View>
            </View>
            {renderTimeField("Fim Invent├írio", "terminoInventario")}
          </View>

          <Pressable style={styles.buttonPrimary} onPress={() => setPreviewVisible(true)}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.btnText}>Gerar Relat├│rio</Text>
          </Pressable>
          <View style={[styles.row, { marginTop: 8, gap: 8 }]}>
            <Pressable style={[styles.buttonClear, { flex: 1 }]} onPress={handleClearOnly}>
              <Text style={styles.btnTextDanger}>Limpar</Text>
            </Pressable>
            <Pressable style={[styles.buttonClear, { flex: 1, backgroundColor: "#E2E8F0" }]} onPress={() => void handleArchive(true)}>
              <Text style={[styles.btnTextDanger, { color: "#334155" }]}>Limpar/Arquivar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={previewVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.sectionTitle}>Pr├®-visualiza├º├úo</Text>
            <ScrollView style={styles.previewBox}>
              <Text>{formatReportD(report)}</Text>
            </ScrollView>
            <View style={styles.row}>
              <Pressable style={styles.btnBack} onPress={() => setPreviewVisible(false)}>
                <Text>Voltar</Text>
              </Pressable>
              <Pressable style={styles.buttonPrimary} onPress={handleSend}>
                <Text style={styles.btnText}>Enviar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 16 },
  section: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
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
  },
  row: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 8 },
  half: { flex: 1 },
  inputGroup: { marginBottom: 8 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nowBtn: {
    padding: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    marginTop: 4,
  },
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
  btnBack: {
    flex: 1,
    padding: 14,
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
  },
});
