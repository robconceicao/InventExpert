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
import type { ReportC } from "../types";
import { formatReportC } from "../utils/parsers";

const STORAGE_KEY = "inventexpert:reportC";
const HISTORY_KEY = "inventexpert:reportC:history";

const initialState: ReportC = {
  inventario_ref: "",
  cliente: "FARMACONDE",
  filial: "",
  lider: "",
  qtdEquipe: "",
  qtdFaltas: "",
  inicioContagemGeral: "",
  fimContagemGeral: "",
  pctInventario: "",
  naoContadosInicio: "",
  naoContadosTotal: "",
  naoContadosFim: "",
  div1Inicio: "",
  div1Controlados: "",
  div1Negativos: "",
  div1Positivos: "",
  div1Total: "",
  div1Fim: "",
  div2Inicio: "",
  div2Negativos: "",
  div2Positivos: "",
  div2Total: "",
  div2Fim: "",
};

export default function ReportCScreen() {
  const [report, setReport] = useState<ReportC>(initialState);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((res) => {
      if (res) setReport(JSON.parse(res));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(report)).catch(() => null);
  }, [report]);

  const setField = <K extends keyof ReportC>(key: K, value: ReportC[K]) => {
    setReport((prev) => ({ ...prev, [key]: value }));
  };

  const setTimeNow = (key: keyof ReportC) => {
    const now = new Date();
    const time = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setField(key, time);
  };

  const renderTimeField = (label: string, field: keyof ReportC) => (
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
    const msg = formatReportC(report);
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
        ? (JSON.parse(stored) as { savedAt: string; report: ReportC }[])
        : [];
      history.push({
        savedAt: new Date().toISOString(),
        report: { ...report },
      });
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      await enqueueSyncItem("reportC", { report });
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Identificação (Farmaconde)</Text>
            <Text style={styles.label}>Inventário (Ref/Data)</Text>
            <TextInput style={styles.input} value={report.inventario_ref} onChangeText={(t) => setField("inventario_ref", t)} placeholder="ex: 12/12/2023" />
            <View style={styles.row}>
                <View style={styles.half}>
                    <Text style={styles.label}>Loja/Cliente</Text>
                    <TextInput style={styles.input} value={report.cliente} onChangeText={(t) => setField("cliente", t)} />
                </View>
                <View style={styles.half}>
                    <Text style={styles.label}>Filial</Text>
                    <TextInput style={styles.input} value={report.filial} onChangeText={(t) => setField("filial", t)} />
                </View>
            </View>
            <Text style={styles.label}>Líder</Text>
            <TextInput style={styles.input} value={report.lider} onChangeText={(t) => setField("lider", t)} />
            <View style={styles.row}>
                <View style={styles.half}>
                    <Text style={styles.label}>Qtd. Equipe</Text>
                    <TextInput style={styles.input} value={String(report.qtdEquipe)} onChangeText={(t) => setField("qtdEquipe", t === "" ? "" : Number(t))} keyboardType="numeric" />
                </View>
                <View style={styles.half}>
                    <Text style={styles.label}>Qtd. Faltas</Text>
                    <TextInput style={styles.input} value={String(report.qtdFaltas)} onChangeText={(t) => setField("qtdFaltas", t === "" ? "" : Number(t))} keyboardType="numeric" />
                </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Mapeamento</Text>
            {renderTimeField("Início Contagem (Geral)", "inicioContagemGeral")}
            {renderTimeField("Fim Contagem (Geral)", "fimContagemGeral")}
            <Text style={styles.label}>% do Inventário</Text>
            <TextInput style={styles.input} value={String(report.pctInventario)} onChangeText={(t) => setField("pctInventario", t === "" ? "" : Number(t))} keyboardType="numeric" placeholder="%" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Não Contados</Text>
            {renderTimeField("Início (zerados)", "naoContadosInicio")}
            <Text style={styles.label}>Total de Itens</Text>
            <TextInput style={styles.input} value={String(report.naoContadosTotal)} onChangeText={(t) => setField("naoContadosTotal", t === "" ? "" : Number(t))} keyboardType="numeric" />
            {renderTimeField("Fim (zerados)", "naoContadosFim")}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. 1ª Divergência</Text>
            {renderTimeField("Início da divergência", "div1Inicio")}
            <View style={styles.row}>
                <View style={styles.half}>
                    <Text style={styles.label}>Itens Controlados</Text>
                    <TextInput style={styles.input} value={String(report.div1Controlados)} onChangeText={(t) => setField("div1Controlados", t === "" ? "" : Number(t))} keyboardType="numeric" />
                </View>
                <View style={styles.half}>
                    <Text style={styles.label}>Negativos (perdas)</Text>
                    <TextInput style={styles.input} value={String(report.div1Negativos)} onChangeText={(t) => setField("div1Negativos", t === "" ? "" : Number(t))} keyboardType="numeric" />
                </View>
            </View>
            <View style={styles.row}>
                <View style={styles.half}>
                    <Text style={styles.label}>Positivos (sobras)</Text>
                    <TextInput style={styles.input} value={String(report.div1Positivos)} onChangeText={(t) => setField("div1Positivos", t === "" ? "" : Number(t))} keyboardType="numeric" />
                </View>
                <View style={styles.half}>
                    <Text style={styles.label}>Total de Itens</Text>
                    <TextInput style={styles.input} value={String(report.div1Total)} onChangeText={(t) => setField("div1Total", t === "" ? "" : Number(t))} keyboardType="numeric" />
                </View>
            </View>
            {renderTimeField("Fim da divergência", "div1Fim")}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. 2ª Divergência</Text>
            {renderTimeField("Início da divergência", "div2Inicio")}
            <View style={styles.row}>
                <View style={styles.half}>
                    <Text style={styles.label}>Negativos (perdas)</Text>
                    <TextInput style={styles.input} value={String(report.div2Negativos)} onChangeText={(t) => setField("div2Negativos", t === "" ? "" : Number(t))} keyboardType="numeric" />
                </View>
                <View style={styles.half}>
                    <Text style={styles.label}>Positivos (sobras)</Text>
                    <TextInput style={styles.input} value={String(report.div2Positivos)} onChangeText={(t) => setField("div2Positivos", t === "" ? "" : Number(t))} keyboardType="numeric" />
                </View>
            </View>
            <Text style={styles.label}>Total de Itens</Text>
            <TextInput style={styles.input} value={String(report.div2Total)} onChangeText={(t) => setField("div2Total", t === "" ? "" : Number(t))} keyboardType="numeric" />
            {renderTimeField("Fim da divergência", "div2Fim")}
          </View>

          <Pressable style={styles.buttonPrimary} onPress={() => setPreviewVisible(true)}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.btnText}>Gerar Relatório</Text>
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
            <Text style={styles.sectionTitle}>Pré-visualização</Text>
            <ScrollView style={styles.previewBox}>
              <Text>{formatReportC(report)}</Text>
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
