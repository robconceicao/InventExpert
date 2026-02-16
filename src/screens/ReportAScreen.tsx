import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useLayoutEffect, useState } from "react";
import {
  Alert,
  Image,
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
import type { ReportA } from "../types";
import { enqueueSyncItem, syncQueue } from "../services/sync";
import { formatReportA } from "../utils/parsers";

const HeaderIcon = require("../../assets/images/splash-icon.png");
const STORAGE_KEY = "inventexpert:reportA";
const HISTORY_KEY = "inventexpert:reportA:history";

const initialState: ReportA = {
  lojaNum: "",
  lojaNome: "",
  qtdColaboradores: "",
  lider: "",
  hrChegada: "",
  inicioContagemEstoque: "",
  terminoContagemEstoque: "",
  inicioContagemLoja: "",
  terminoContagemLoja: "",
  inicioDivergencia: "",
  terminoDivergencia: "",
  terminoInventario: "",
  avanco22h: "",
  avanco00h: "",
  avanco01h: "",
  avanco03h: "",
  avanco04h: "",
  avancoExtraHora: "",
  avancoExtraValor: "",
  envioArquivo1: "",
  envioArquivo2: "",
  envioArquivo3: "",
  avalEstoque: "",
  avalLoja: "",
  acuracidade: "",
  percentualAuditoria: "",
  ph: "",
  satisfacao: "",
  contagemAntecipada: null,
};

export default function ReportAScreen() {
  const navigation = useNavigation();
  const [report, setReport] = useState<ReportA>(initialState);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Remove cabeçalho duplicado
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((res) => {
      if (res) setReport(JSON.parse(res));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(report)).catch(() => null);
  }, [report]);

  const setField = <K extends keyof ReportA>(key: K, value: ReportA[K]) => {
    setReport((prev) => ({ ...prev, [key]: value }));
  };

  const setTimeNow = (key: keyof ReportA) => {
    const now = new Date();
    const time = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setField(key, time);
  };

  const renderTimeField = (label: string, field: keyof ReportA) => (
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
    const msg = formatReportA(report);
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`);
  };

  const handleArchive = async (clearForm: boolean) => {
    try {
      const stored = await AsyncStorage.getItem(HISTORY_KEY);
      const history = stored
        ? (JSON.parse(stored) as Array<{ savedAt: string; report: ReportA }>)
        : [];
      history.push({ savedAt: new Date().toISOString(), report: { ...report } });
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      await enqueueSyncItem("reportA", { report });
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

      <View style={styles.header}>
        <Image
          source={HeaderIcon}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>Acompanhamento</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Identificação</Text>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Nº Loja</Text>
                <TextInput
                  style={styles.input}
                  value={report.lojaNum}
                  onChangeText={(t) => setField("lojaNum", t)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Qtd. Colab.</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.qtdColaboradores)}
                  onChangeText={(t) =>
                    setField("qtdColaboradores", Number(t) || "")
                  }
                  keyboardType="numeric"
                />
              </View>
            </View>
            <Text style={styles.label}>Nome da Loja</Text>
            <TextInput
              style={styles.input}
              value={report.lojaNome}
              onChangeText={(t) => setField("lojaNome", t)}
            />
            <Text style={styles.label}>Líder do Inventário</Text>
            <TextInput
              style={styles.input}
              value={report.lider}
              onChangeText={(t) => setField("lider", t)}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Cronograma</Text>
            {renderTimeField("Chegada", "hrChegada")}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Ini. Estoque", "inicioContagemEstoque")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Estoque", "terminoContagemEstoque")}
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Ini. Loja", "inicioContagemLoja")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Loja", "terminoContagemLoja")}
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
            {renderTimeField("Término Inventário", "terminoInventario")}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Avanço (%)</Text>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>22:00</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.avanco22h)}
                  onChangeText={(t) => setField("avanco22h", Number(t) || "")}
                  keyboardType="numeric"
                  placeholder="%"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>00:00</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.avanco00h)}
                  onChangeText={(t) => setField("avanco00h", Number(t) || "")}
                  keyboardType="numeric"
                  placeholder="%"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>01:00</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.avanco01h)}
                  onChangeText={(t) => setField("avanco01h", Number(t) || "")}
                  keyboardType="numeric"
                  placeholder="%"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>03:00</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.avanco03h)}
                  onChangeText={(t) => setField("avanco03h", Number(t) || "")}
                  keyboardType="numeric"
                  placeholder="%"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>04:00</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.avanco04h)}
                  onChangeText={(t) => setField("avanco04h", Number(t) || "")}
                  keyboardType="numeric"
                  placeholder="%"
                />
              </View>
            </View>
            <View style={styles.customTimeBox}>
              <Text style={styles.customTimeTitle}>Incluir novo horário (opcional)</Text>
              <View style={styles.row}>
                <View style={styles.half}>
                  {renderTimeField("Hora", "avancoExtraHora")}
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>Avanço (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={String(report.avancoExtraValor)}
                    onChangeText={(t) =>
                      setField("avancoExtraValor", Number(t) || "")
                    }
                    keyboardType="numeric"
                    placeholder="%"
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Gestão</Text>
            {renderTimeField("Envio 1º Arq", "envioArquivo1")}
            {renderTimeField("Envio 2º Arq", "envioArquivo2")}
            {renderTimeField("Envio 3º Arq", "envioArquivo3")}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Indicadores</Text>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Aval. Estoque (%)</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.avalEstoque)}
                  onChangeText={(t) => setField("avalEstoque", Number(t) || "")}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Aval. Loja (%)</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.avalLoja)}
                  onChangeText={(t) => setField("avalLoja", Number(t) || "")}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Acuracidade (%)</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.acuracidade)}
                  onChangeText={(t) => setField("acuracidade", Number(t) || "")}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>% Auditoria</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.percentualAuditoria)}
                  onChangeText={(t) =>
                    setField("percentualAuditoria", Number(t) || "")
                  }
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>PH</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.ph)}
                  onChangeText={(t) => setField("ph", Number(t) || "")}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Satisfação (ex: 4.5)</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.satisfacao)}
                  onChangeText={(t) => {
                    const v = t.replace(",", ".").trim();
                    const num = parseFloat(v);
                    setField("satisfacao", v === "" ? "" : (isNaN(num) ? report.satisfacao : num));
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0-5"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Status</Text>
            <Text style={styles.label}>Contagem Antecipada?</Text>
            <View style={styles.row}>
              <Pressable
                onPress={() => setField("contagemAntecipada", true)}
                style={[
                  styles.radioBtn,
                  report.contagemAntecipada === true && styles.radioBtnSelected,
                ]}
              >
                <Text
                  style={[
                    styles.radioTxt,
                    report.contagemAntecipada === true &&
                      styles.radioTxtSelected,
                  ]}
                >
                  Sim
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setField("contagemAntecipada", false)}
                style={[
                  styles.radioBtn,
                  report.contagemAntecipada === false &&
                    styles.radioBtnSelected,
                ]}
              >
                <Text
                  style={[
                    styles.radioTxt,
                    report.contagemAntecipada === false &&
                      styles.radioTxtSelected,
                  ]}
                >
                  Não
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            style={styles.buttonPrimary}
            onPress={() => setPreviewVisible(true)}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.btnText}>Gerar Relatório</Text>
          </Pressable>
          <View style={[styles.row, { marginTop: 8, gap: 8 }]}>
            <Pressable
              style={[styles.buttonClear, { flex: 1 }]}
              onPress={handleClearOnly}
            >
              <Text style={styles.btnTextDanger}>Limpar</Text>
            </Pressable>
            <Pressable
              style={[styles.buttonClear, { flex: 1, backgroundColor: "#E2E8F0" }]}
              onPress={() => void handleArchive(true)}
            >
              <Text style={[styles.btnTextDanger, { color: "#334155" }]}>
                Limpar/Arquivar
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={previewVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.sectionTitle}>Pré-visualização</Text>
            <ScrollView style={styles.previewBox}>
              <Text>{formatReportA(report)}</Text>
            </ScrollView>
            <View style={styles.row}>
              <Pressable
                style={styles.btnBack}
                onPress={() => setPreviewVisible(false)}
              >
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    padding: 16,
  },
  headerLogo: { width: 32, height: 32, marginRight: 10, borderRadius: 6 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
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
  radioBtn: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    alignItems: "center",
  },
  radioBtnSelected: { backgroundColor: "#EFF6FF", borderColor: "#2563EB" },
  radioTxt: { color: "#64748B", fontWeight: "bold" },
  radioTxtSelected: { color: "#2563EB" },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#E2E8F0",
    marginTop: 24,
  },
  toggleBtnActive: { backgroundColor: "#16A34A" },
  toggleTxt: { fontSize: 12, fontWeight: "bold", color: "#64748B" },
  customTimeBox: {
    backgroundColor: "#F0FDF4",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  customTimeTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#166534",
    marginBottom: 5,
  },
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
