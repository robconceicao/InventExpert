import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Speech from "expo-speech";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
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
import { analyzeInventoryGaps } from "../services/deepseek";
import type { ReportA } from "../types";
import { formatReportA } from "../utils/parsers";

// ---------------------------------------------------------------------------
// Notificações locais
// ---------------------------------------------------------------------------
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const STORAGE_KEY = "inventexpert:reportA";
const HISTORY_KEY = "inventexpert:reportA:history";
const ALARM_VOICE_MSG =
  "Solicitar conferentes que exportem os dados dos coletores.";

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

// Horários monitorados para aviso (15 min antes)
const MONITORED_ADVANCES = [
  { label: "00h00", hour: 0, minute: 0 },
  { label: "01h00", hour: 1, minute: 0 },
  { label: "03h00", hour: 3, minute: 0 },
  { label: "04h00", hour: 4, minute: 0 },
];

// Retorna true se agora está entre 14-15 min antes do horário alvo
const isWarningTime = (targetHour: number, targetMin: number): boolean => {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  // alvo em minutos do dia
  let targetMins = targetHour * 60 + targetMin;
  // Ajuste: horários noturnos (0-5h) considerados como "dia seguinte"
  if (targetHour < 18 && now.getHours() >= 18) {
    targetMins += 1440;
  }
  const diff = targetMins - nowMins;
  return diff >= 14 && diff < 15;
};

export default function ReportAScreen() {
  const [report, setReport] = useState<ReportA>(initialState);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiModalVisible, setAiModalVisible] = useState(false);

  const handleAiAudit = async () => {
    setAiLoading(true);
    setAiModalVisible(true);
    try {
      const reportText = formatReportA(report);
      const result = await analyzeInventoryGaps(reportText);
      if (result.success) {
        setAiResult(result.text);
      } else {
        setAiResult(`Falha ao gerar auditoria: ${result.error}`);
      }
    } catch (err) {
      setAiResult(`Erro inesperado: ${String(err)}`);
    } finally {
      setAiLoading(false);
    }
  };

  const [alarmActive, setAlarmActive] = useState(false);
  const [alarmLabel, setAlarmLabel] = useState("");
  const alarmTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const monitorTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef = useRef<Set<string>>(new Set());

  // ── Carrega dados salvos (apenas na montagem, sem auto-save no mount)
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((res) => {
      if (res) setReport(JSON.parse(res));
    });
  }, []);

  // ── Auto-save sempre que report muda, e sincroniza com ReportB
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(report)).catch(() => null);

    AsyncStorage.getItem("inventexpert:reportB").then((res) => {
      const bReport = res ? JSON.parse(res) : {};
      const updatedB = {
        ...bReport,
        cliente: report.lojaNome || bReport.cliente || "",
        lojaNum: report.lojaNum || bReport.lojaNum || "",
        chegadaEquipe: report.hrChegada || bReport.chegadaEquipe || "",
        inicioDeposito: report.inicioContagemEstoque || bReport.inicioDeposito || "",
        terminoDeposito: report.terminoContagemEstoque || bReport.terminoDeposito || "",
        inicioLoja: report.inicioContagemLoja || bReport.inicioLoja || "",
        terminoLoja: report.terminoContagemLoja || bReport.terminoLoja || "",
        inicioDivergencia: report.inicioDivergencia || bReport.inicioDivergencia || "",
        envioArquivo1: report.envioArquivo1 || bReport.envioArquivo1 || "",
        envioArquivo2: report.envioArquivo2 || bReport.envioArquivo2 || "",
        envioArquivo3: report.envioArquivo3 || bReport.envioArquivo3 || "",
        avalPrepDeposito: report.avalEstoque || bReport.avalPrepDeposito || "",
        avalPrepLoja: report.avalLoja || bReport.avalPrepLoja || "",
        satisfacao: report.satisfacao || bReport.satisfacao || "",
        responsavel: report.lider || bReport.responsavel || "",
        terminoInventario: report.terminoInventario || bReport.terminoInventario || "",
      };
      AsyncStorage.setItem("inventexpert:reportB", JSON.stringify(updatedB)).catch(() => null);
    });
  }, [report]);

  // ── Monitor de avanços: verifica a cada 30s
  useEffect(() => {
    const requestPermission = async () => {
      if (Platform.OS !== "web") {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          console.warn("[ReportA] Permissão de notificação negada.");
        }
      }
    };
    void requestPermission();

    monitorTimerRef.current = setInterval(() => {
      for (const adv of MONITORED_ADVANCES) {
        if (!firedRef.current.has(adv.label) && isWarningTime(adv.hour, adv.minute)) {
          firedRef.current.add(adv.label);
          triggerAlarm(adv.label);
          break;
        }
      }
    }, 30_000);

    return () => {
      if (monitorTimerRef.current) clearInterval(monitorTimerRef.current);
      stopAlarm();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerAlarm = (label: string) => {
    setAlarmLabel(label);
    setAlarmActive(true);

    // Notificação local (bipe do sistema)
    if (Platform.OS !== "web") {
      void Notifications.scheduleNotificationAsync({
        content: {
          title: `⏰ Avanço ${label} em 15 minutos`,
          body: ALARM_VOICE_MSG,
          sound: true,
        },
        trigger: null,
      });
    }

    // Voz repetitiva a cada 30s enquanto alarme ativo
    speakWarning();
    alarmTimerRef.current = setInterval(() => {
      speakWarning();
    }, 30_000);
  };

  const speakWarning = () => {
    if (Platform.OS !== "web") {
      void Speech.stop().then(() => {
        Speech.speak(ALARM_VOICE_MSG, {
          language: "pt-BR",
          rate: 0.9,
          pitch: 1.0,
        });
      });
    }
  };

  const stopAlarm = () => {
    if (alarmTimerRef.current) {
      clearInterval(alarmTimerRef.current);
      alarmTimerRef.current = null;
    }
    if (Platform.OS !== "web") {
      void Speech.stop();
    }
    setAlarmActive(false);
    setAlarmLabel("");
  };

  const setField = <K extends keyof ReportA>(key: K, value: ReportA[K]) => {
    setReport((prev) => ({ ...prev, [key]: value }));
  };

  const setTimeNow = (key: keyof ReportA) => {
    const now = new Date();
    const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
        ? (JSON.parse(stored) as { savedAt: string; report: ReportA }[])
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
      { text: "Limpar", style: "destructive", onPress: () => setReport(initialState) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />

      {/* Banner de alarme ativo */}
      {alarmActive && (
        <View style={styles.alarmBanner}>
          <View style={styles.alarmTextBlock}>
            <Text style={styles.alarmTitle}>⏰ Avanço {alarmLabel} em 15 min</Text>
            <Text style={styles.alarmMsg}>{ALARM_VOICE_MSG}</Text>
          </View>
          <Pressable style={styles.alarmStopBtn} onPress={stopAlarm}>
            <Ionicons name="stop-circle" size={28} color="#fff" />
            <Text style={styles.alarmStopTxt}>Parar</Text>
          </Pressable>
        </View>
      )}

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
                  onChangeText={(t) => setField("qtdColaboradores", t === "" ? "" : Number(t))}
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
              <View style={styles.half}>{renderTimeField("Ini. Estoque", "inicioContagemEstoque")}</View>
              <View style={styles.half}>{renderTimeField("Fim Estoque", "terminoContagemEstoque")}</View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>{renderTimeField("Ini. Loja", "inicioContagemLoja")}</View>
              <View style={styles.half}>{renderTimeField("Fim Loja", "terminoContagemLoja")}</View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>{renderTimeField("Ini. Diverg.", "inicioDivergencia")}</View>
              <View style={styles.half}>{renderTimeField("Fim Diverg.", "terminoDivergencia")}</View>
            </View>
            {renderTimeField("Fim Inventário", "terminoInventario")}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Avanço (%)</Text>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>22:00</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.avanco22h)}
                  onChangeText={(t) => setField("avanco22h", t)}
                  keyboardType="numeric"
                  placeholder="%"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>00:00</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.avanco00h)}
                  onChangeText={(t) => setField("avanco00h", t)}
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
                  onChangeText={(t) => setField("avanco01h", t)}
                  keyboardType="numeric"
                  placeholder="%"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>03:00</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.avanco03h)}
                  onChangeText={(t) => setField("avanco03h", t)}
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
                  onChangeText={(t) => setField("avanco04h", t)}
                  keyboardType="numeric"
                  placeholder="%"
                />
              </View>
            </View>
            <View style={styles.customTimeBox}>
              <Text style={styles.customTimeTitle}>Incluir novo horário</Text>
              <View style={styles.row}>
                <View style={styles.half}>{renderTimeField("Hora", "avancoExtraHora")}</View>
                <View style={styles.half}>
                  <Text style={styles.label}>Avanço (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={String(report.avancoExtraValor)}
                    onChangeText={(t) => setField("avancoExtraValor", t)}
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
                  onChangeText={(t) => setField("avalEstoque", t)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Aval. Loja (%)</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.avalLoja)}
                  onChangeText={(t) => setField("avalLoja", t)}
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
                  onChangeText={(t) => setField("acuracidade", t)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>% Auditoria</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.percentualAuditoria)}
                  onChangeText={(t) => setField("percentualAuditoria", t)}
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
                  onChangeText={(t) => setField("ph", t)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Satisfação (ex: 4.5)</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.satisfacao)}
                  onChangeText={(t) => setField("satisfacao", t.replace(",", ".").trim())}
                  keyboardType="numeric"
                  placeholder="ex: 4.5"
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
                style={[styles.radioBtn, report.contagemAntecipada === true && styles.radioBtnSelected]}
              >
                <Text style={[styles.radioTxt, report.contagemAntecipada === true && styles.radioTxtSelected]}>
                  Sim
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setField("contagemAntecipada", false)}
                style={[styles.radioBtn, report.contagemAntecipada === false && styles.radioBtnSelected]}
              >
                <Text style={[styles.radioTxt, report.contagemAntecipada === false && styles.radioTxtSelected]}>
                  Não
                </Text>
              </Pressable>
            </View>
          </View>

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
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={styles.sectionTitle}>Pré-visualização</Text>
              <Pressable
                onPress={handleAiAudit}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#eff6ff",
                  borderColor: "#bfdbfe",
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  gap: 4
                }}
              >
                <Ionicons name="sparkles" size={14} color="#1d4ed8" />
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#1d4ed8" }}>Auditoria IA</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.previewBox}>
              <Text style={{ fontSize: 12, lineHeight: 18, color: "#334155" }}>{formatReportA(report)}</Text>
            </ScrollView>
            <View style={[styles.row, { gap: 8, marginTop: 12 }]}>
              <Pressable style={[styles.btnBack, { flex: 1 }]} onPress={() => setPreviewVisible(false)}>
                <Text style={{ fontWeight: "600", color: "#475569", textAlign: "center" }}>Voltar</Text>
              </Pressable>
              <Pressable style={[styles.buttonPrimary, { flex: 1, marginVertical: 0 }]} onPress={handleSend}>
                <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                <Text style={styles.btnText}>Enviar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Auditoria Inteligente DeepSeek */}
      <Modal
        visible={aiModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAiModalVisible(false)}
      >
        <View style={styles.aiModalOverlay}>
          <View style={styles.aiModalContent}>
            <View style={styles.aiModalHeader}>
              <Ionicons name="sparkles" size={22} color="#1d4ed8" />
              <Text style={styles.aiModalTitle}>Auditoria de Gargalos IA</Text>
              <Pressable onPress={() => setAiModalVisible(false)} style={styles.aiCloseBtn}>
                <Ionicons name="close-circle" size={24} color="#64748b" />
              </Pressable>
            </View>

            {aiLoading ? (
              <View style={styles.aiLoadingContainer}>
                <ActivityIndicator size="large" color="#1d4ed8" />
                <Text style={styles.aiLoadingText}>DeepSeek auditando tempos e acuracidade...</Text>
                <Text style={styles.aiLoadingSubtext}>Isso pode levar alguns segundos.</Text>
              </View>
            ) : (
              <ScrollView style={styles.aiResultScroll}>
                <Text style={styles.aiResultText}>{aiResult}</Text>
              </ScrollView>
            )}

            <View style={styles.aiModalFooter}>
              <Pressable style={styles.aiModalCloseBtn} onPress={() => setAiModalVisible(false)}>
                <Text style={styles.aiModalCloseBtnText}>Fechar Diagnóstico</Text>
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
  alarmBanner: {
    backgroundColor: "#DC2626",
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  alarmTextBlock: { flex: 1 },
  alarmTitle: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  alarmMsg: { color: "#FEE2E2", fontSize: 12, marginTop: 2 },
  alarmStopBtn: { alignItems: "center", justifyContent: "center", gap: 2 },
  alarmStopTxt: { color: "#fff", fontSize: 10, fontWeight: "bold" },
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
  nowBtn: { padding: 10, backgroundColor: "#EFF6FF", borderRadius: 8, marginTop: 4 },
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
  customTimeBox: {
    backgroundColor: "#F0FDF4",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  customTimeTitle: { fontSize: 12, fontWeight: "bold", color: "#166534", marginBottom: 5 },
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
  aiModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  aiModalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    width: "100%",
    maxHeight: "85%",
    padding: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  aiModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 12,
  },
  aiModalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  aiCloseBtn: {
    padding: 2,
  },
  aiLoadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    gap: 12,
  },
  aiLoadingText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
  },
  aiLoadingSubtext: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  aiResultScroll: {
    marginVertical: 14,
    maxHeight: 350,
  },
  aiResultText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 20,
  },
  aiModalFooter: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },
  aiModalCloseBtn: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  aiModalCloseBtnText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "700",
  },
});
