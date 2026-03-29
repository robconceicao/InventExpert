import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import React, {
    useCallback,
    useEffect,
    useState,
} from "react";
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
import type { ReportB } from "../types";
import { formatReportB } from "../utils/parsers";

const REPORT_B_KEY = "inventexpert:reportB";
const REPORT_B_HISTORY_KEY = "inventexpert:reportB:history";

const makeInitialState = (): ReportB => ({
  cliente: "",
  lojaNum: "",
  data: new Date().toLocaleDateString("pt-BR"),
  pivProgramado: "",
  pivRealizado: "",
  chegadaEquipe: "",
  inicioDeposito: "",
  terminoDeposito: "",
  inicioLoja: "",
  terminoLoja: "",
  inicioAuditoriaCliente: "",
  terminoAuditoriaCliente: "",
  inicioControlados: "",
  inicioDivergencia: "",
  terminoDivergencia: "",
  inicioNaoContados: "",
  terminoNaoContados: "",
  qtdAlterados: "",
  qtdNaoContados: "",
  qtdEncontradosNaoContados: "",
  totalPecas: "",
  valorFinanceiro: "",
  envioArquivo1: "",
  envioArquivo2: "",
  envioArquivo3: "",
  avalPrepDeposito: "",
  avalPrepLoja: "",
  acuracidadeCliente: "",
  acuracidadeTerceirizada: "",
  satisfacao: "",
  responsavel: "",
  suporteSolicitado: null,
  terminoInventario: "",
});


export default function ReportBScreen() {
  const [report, setReport] = useState<ReportB>(makeInitialState);
  const [backupUri, setBackupUri] = useState<string | null>(null);
  const [backupName, setBackupName] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [isSharingBackup, setIsSharingBackup] = useState(false);


  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const savedB = await AsyncStorage.getItem(REPORT_B_KEY);
        if (savedB) {
          setReport(JSON.parse(savedB));
        }
      };
      load();
    }, []),
  );

  useEffect(() => {
    AsyncStorage.setItem(REPORT_B_KEY, JSON.stringify(report)).catch(
      () => null,
    );
  }, [report]);

  const setField = <K extends keyof ReportB>(key: K, value: ReportB[K]) => {
    setReport((prev) => ({ ...prev, [key]: value }));
  };

  const setTimeNow = (key: keyof ReportB) => {
    const now = new Date();
    const time = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setField(key, time);
  };

  const renderTimeField = (label: string, field: keyof ReportB) => (
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

  const pickBackup = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/zip", "application/x-zip-compressed", "*/*"],
      copyToCacheDirectory: true,
    });
    if (!res.canceled && res.assets.length > 0) {
      const asset = res.assets[0];
      setBackupUri(asset.uri);
      setBackupName(asset.name);
    }
  };

  const handleSendText = () => {
    const msg = formatReportB(report);
    const waUrl =
      Platform.OS === "web"
        ? `https://wa.me/?text=${encodeURIComponent(msg)}`
        : `whatsapp://send?text=${encodeURIComponent(msg)}`;
    Linking.openURL(waUrl).catch(() => {
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp");
    });
  };

  const handleShareBackup = async () => {
    if (!backupUri) {
      Alert.alert("Atenção", "Nenhum arquivo de backup selecionado.");
      return;
    }
    if (Platform.OS === "web") {
      Alert.alert(
        "Backup selecionado ✅",
        `Arquivo: ${backupName ?? "backup"}\n\nEnvie manualmente pelo WhatsApp Web após enviar o texto.`,
      );
      return;
    }
    try {
      setIsSharingBackup(true);
      // Dynamic require avoids loading the native module on web
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const RNShare = (require("react-native-share") as { default: { open: (opts: Record<string, unknown>) => Promise<void> } }).default;
      await RNShare.open({
        url: backupUri,
        title: "Backup do inventário",
        message: "Backup do inventário",
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err?.message !== "User did not share") {
        Alert.alert("Erro", "Falha ao compartilhar o backup.");
      }
    } finally {
      setIsSharingBackup(false);
    }
  };

  const handleArchive = async (clearForm: boolean) => {
    try {
      const stored = await AsyncStorage.getItem(REPORT_B_HISTORY_KEY);
      const history = stored
        ? (JSON.parse(stored) as { savedAt: string; report: ReportB }[])
        : [];
      history.push({
        savedAt: new Date().toISOString(),
        report: { ...report },
      });
      await AsyncStorage.setItem(REPORT_B_HISTORY_KEY, JSON.stringify(history));
      await enqueueSyncItem("reportB", { report });
      void syncQueue();
      if (clearForm) {
        setReport(makeInitialState());
        setBackupUri(null);
        setBackupName(null);
        Alert.alert("Arquivado", "Dados salvos e formulário limpo.");
      } else {
        Alert.alert("Arquivado", "Dados salvos com sucesso.");
      }
    } catch {
      Alert.alert("Erro", "Não foi possível arquivar.");
    }
  };

  const handleClearOnly = () => {
    Alert.alert(
      "Limpar Tudo?",
      "Isso apagará os dados e o backup atual sem salvar.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpar",
          style: "destructive",
          onPress: () => {
            setReport(makeInitialState());
            setBackupUri(null);
            setBackupName(null);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* ... MANTENHA TODOS OS CAMPOS DO FORMULÁRIO IGUAIS (Seções 1 a 6) ... */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Identificação</Text>
            <Text style={styles.label}>Cliente</Text>
            <TextInput
              style={styles.input}
              value={report.cliente}
              onChangeText={(t) => setField("cliente", t)}
            />
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
                <Text style={styles.label}>Data</Text>
                <TextInput
                  style={styles.input}
                  value={report.data}
                  onChangeText={(t) => setField("data", t)}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>PIV Prog.</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.pivProgramado)}
                  onChangeText={(t) =>
                    setField("pivProgramado", t === "" ? "" : Number(t))
                  }
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>PIV Real.</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.pivRealizado)}
                  onChangeText={(t) =>
                    setField("pivRealizado", t === "" ? "" : Number(t))
                  }
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Cronograma Operacional</Text>
            {renderTimeField("Chegada Equipe", "chegadaEquipe")}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Início Dep.", "inicioDeposito")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Dep.", "terminoDeposito")}
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Início Loja", "inicioLoja")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Loja", "terminoLoja")}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Auditoria e Divergências</Text>
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Início Aud. Cliente", "inicioAuditoriaCliente")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Aud. Cliente", "terminoAuditoriaCliente")}
              </View>
            </View>
            {renderTimeField("Ini. Div. Controlados", "inicioControlados")}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Ini. Diverg.", "inicioDivergencia")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Diverg.", "terminoDivergencia")}
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Ini. Ñ Cont.", "inicioNaoContados")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Ñ Cont.", "terminoNaoContados")}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Resultado</Text>
            <Text style={styles.label}>Total de Peças</Text>
            <TextInput
              style={styles.input}
              value={String(report.totalPecas)}
              onChangeText={(t) => setField("totalPecas", t === "" ? "" : Number(t))}
              keyboardType="numeric"
              placeholder="0"
            />
            <Text style={styles.label}>Valor Financeiro (R$)</Text>
            <TextInput
              style={styles.input}
              value={String(report.valorFinanceiro)}
              onChangeText={(t) => setField("valorFinanceiro", t === "" ? "" : Number(t))}
              keyboardType="numeric"
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Alt. Diverg.</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.qtdAlterados)}
                  onChangeText={(t) =>
                    setField("qtdAlterados", t === "" ? "" : Number(t))
                  }
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Não Cont.</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.qtdNaoContados)}
                  onChangeText={(t) =>
                    setField("qtdNaoContados", t === "" ? "" : Number(t))
                  }
                  keyboardType="numeric"
                />
              </View>
            </View>
            <Text style={styles.label}>Enc. no Não Contado</Text>
            <TextInput
              style={styles.input}
              value={String(report.qtdEncontradosNaoContados)}
              onChangeText={(t) =>
                setField("qtdEncontradosNaoContados", t === "" ? "" : Number(t))
              }
              keyboardType="numeric"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Envio de Arquivos</Text>
            {renderTimeField("Envio 1º Arq", "envioArquivo1")}
            {renderTimeField("Envio 2º Arq", "envioArquivo2")}
            {renderTimeField("Envio 3º Arq", "envioArquivo3")}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              6. Indicadores e Finalização
            </Text>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Aval. Dep. (%)</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.avalPrepDeposito)}
                  onChangeText={(t) =>
                    setField("avalPrepDeposito", t === "" ? "" : Number(t))
                  }
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Aval. Loja (%)</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.avalPrepLoja)}
                  onChangeText={(t) =>
                    setField("avalPrepLoja", t === "" ? "" : Number(t))
                  }
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Acur. Cliente (%)</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.acuracidadeCliente)}
                  onChangeText={(t) =>
                    setField("acuracidadeCliente", t === "" ? "" : Number(t))
                  }
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Acur. Terc. (%)</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.acuracidadeTerceirizada)}
                  onChangeText={(t) =>
                    setField("acuracidadeTerceirizada", t === "" ? "" : Number(t))
                  }
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Satisfação</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.satisfacao)}
                  onChangeText={(t) => {
                    const v = t.replace(",", ".").trim();
                    setField("satisfacao", v);
                  }}
                  keyboardType="numeric"
                  placeholder="ex: 4.5"
                />
              </View>
            </View>
            <Text style={styles.label}>Responsável</Text>
            <TextInput
              style={styles.input}
              value={report.responsavel}
              onChangeText={(t) => setField("responsavel", t)}
            />
            {renderTimeField("Fim Inventário", "terminoInventario")}
            <Text style={styles.label}>Houve solicitação de Suporte?</Text>
            <View style={styles.row}>
              <Pressable
                onPress={() => setField("suporteSolicitado", true)}
                style={[
                  styles.radioBtn,
                  report.suporteSolicitado === true && styles.radioBtnSelected,
                ]}
              >
                <Text
                  style={[
                    styles.radioTxt,
                    report.suporteSolicitado === true &&
                      styles.radioTxtSelected,
                  ]}
                >
                  Sim
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setField("suporteSolicitado", false)}
                style={[
                  styles.radioBtn,
                  report.suporteSolicitado === false && styles.radioBtnSelected,
                ]}
              >
                <Text
                  style={[
                    styles.radioTxt,
                    report.suporteSolicitado === false &&
                      styles.radioTxtSelected,
                  ]}
                >
                  Não
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Backup</Text>
            <Text style={styles.helpText}>
              Selecione o arquivo compactado de backup (zip)
            </Text>
            <Pressable style={styles.buttonPhoto} onPress={pickBackup}>
              <Ionicons name="folder-open-outline" size={24} color="#2563EB" />
              <Text style={styles.btnTextSecondary}>Selecionar Backup</Text>
            </Pressable>
            {backupName ? (
              <Text style={[styles.helpText, { marginTop: 8, color: "#16A34A" }]}>
                ✅ {backupName}
              </Text>
            ) : null}
          </View>

          <Pressable
            style={styles.buttonPrimary}
            onPress={() => setPreviewVisible(true)}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.btnText}>Continuar para Envio</Text>
          </Pressable>

          <View style={[styles.row, { marginTop: 8, gap: 8 }]}>
            <Pressable
              style={[styles.buttonClear, { flex: 1 }]}
              onPress={handleClearOnly}
            >
              <Text style={styles.btnTextDanger}>Limpar</Text>
            </Pressable>
            <Pressable
              style={[
                styles.buttonClear,
                { flex: 1, backgroundColor: "#E2E8F0" },
              ]}
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
            <Text style={styles.sectionTitle}>Pré-visualização e Envio</Text>
            <Text style={styles.helpText}>1. Clique para enviar o Texto.</Text>
            <Text style={styles.helpText}>
              2. Volte e clique para enviar o Backup.
            </Text>

            <ScrollView style={styles.previewBox}>
              <Text>{formatReportB(report)}</Text>
            </ScrollView>

            <View style={styles.row}>
              <Pressable
                style={styles.btnBack}
                onPress={() => setPreviewVisible(false)}
              >
                <Text>Voltar</Text>
              </Pressable>
            </View>

            <Pressable
              style={[
                styles.buttonPrimary,
                { marginTop: 10, backgroundColor: "#25D366" },
              ]}
              onPress={handleSendText}
            >
              <Ionicons
                name="logo-whatsapp"
                size={20}
                color="#fff"
                style={{ marginRight: 10 }}
              />
              <Text style={styles.btnText}>1º Enviar Texto (WhatsApp)</Text>
            </Pressable>

            <Pressable
              style={[
                styles.buttonPrimary,
                { marginTop: 10, backgroundColor: "#0284C7" },
              ]}
              onPress={() => void handleShareBackup()}
              disabled={!backupUri || isSharingBackup}
            >
              {isSharingBackup ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons
                  name="archive"
                  size={20}
                  color="#fff"
                  style={{ marginRight: 10 }}
                />
              )}
              <Text style={styles.btnText}>2º Enviar Backup</Text>
            </Pressable>
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
  helpText: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 10,
    fontStyle: "italic",
  },
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
  buttonPhoto: {
    borderWidth: 1,
    borderColor: "#2563EB",
    borderStyle: "dashed",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  btnTextSecondary: { color: "#2563EB", fontWeight: "bold" },
  buttonClear: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
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
    maxHeight: "90%",
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
