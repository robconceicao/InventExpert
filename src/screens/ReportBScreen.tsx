import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
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
import type { ReportA, ReportB } from "../types";
import { formatReportB } from "../utils/parsers";

const HeaderIcon = require("../../assets/images/splash-icon.png");
const REPORT_A_KEY = "inventexpert:reportA";
const REPORT_B_KEY = "inventexpert:reportB";

const initialState: ReportB = {
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
};

export default function ReportBScreen() {
  const [report, setReport] = useState<ReportB>(initialState);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    const load = async () => {
      const savedB = await AsyncStorage.getItem(REPORT_B_KEY);
      if (savedB) setReport(JSON.parse(savedB));
      else {
        const savedA = await AsyncStorage.getItem(REPORT_A_KEY);
        if (savedA) {
          const rA: ReportA = JSON.parse(savedA);
          setReport((prev) => ({
            ...prev,
            cliente: rA.lojaNome,
            lojaNum: rA.lojaNum,
            pivProgramado: rA.qtdColaboradores,
            chegadaEquipe: rA.hrChegada,
            inicioDeposito: rA.inicioContagemEstoque,
            terminoDeposito: rA.terminoContagemEstoque,
            inicioLoja: rA.inicioContagemLoja,
            terminoLoja: rA.terminoContagemLoja,
            inicioDivergencia: rA.inicioDivergencia,
            terminoDivergencia: rA.terminoDivergencia,
            envioArquivo1: rA.envioArquivo1,
            envioArquivo2: rA.envioArquivo2,
            envioArquivo3: rA.envioArquivo3,
            responsavel: rA.lider,
            terminoInventario: rA.terminoInventario,
          }));
        }
      }
    };
    load();
  }, []);

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

  const pickImages = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (!res.canceled)
      setPhotoUris((prev) => [...prev, ...res.assets.map((a) => a.uri)]);
  };

  const handleSend = async () => {
    const msg = formatReportB(report);
    await Clipboard.setStringAsync(msg);
    Alert.alert(
      "Copiado!",
      "Texto copiado! No WhatsApp:\n1. Cole o texto.\n2. Anexe as fotos manualmente.",
      [
        {
          text: "Abrir WhatsApp",
          onPress: () => Linking.openURL("whatsapp://send"),
        },
      ],
    );
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
        <Text style={styles.headerTitle}>Resumo Final</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
                    setField("pivProgramado", Number(t) || "")
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
                    setField("pivRealizado", Number(t) || "")
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
                {renderTimeField("Ini. Diverg.", "inicioDivergencia")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Diverg.", "terminoDivergencia")}
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Ini. Não Cont.", "inicioNaoContados")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Não Cont.", "terminoNaoContados")}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Resultado</Text>
            <Text style={styles.label}>Total de Peças</Text>
            <TextInput
              style={styles.input}
              value={String(report.totalPecas)}
              onChangeText={(t) => setField("totalPecas", Number(t) || "")}
              keyboardType="numeric"
              placeholder="0"
            />
            <Text style={styles.label}>Valor Financeiro (R$)</Text>
            <TextInput
              style={styles.input}
              value={String(report.valorFinanceiro)}
              onChangeText={(t) => setField("valorFinanceiro", Number(t) || "")}
              keyboardType="numeric"
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Alt. Diverg.</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.qtdAlterados)}
                  onChangeText={(t) =>
                    setField("qtdAlterados", Number(t) || "")
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
                    setField("qtdNaoContados", Number(t) || "")
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
                setField("qtdEncontradosNaoContados", Number(t) || "")
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
                    setField("avalPrepDeposito", Number(t) || "")
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
                    setField("avalPrepLoja", Number(t) || "")
                  }
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Novos campos de Acuracidade */}
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Acur. Cliente (%)</Text>
                <TextInput
                  style={styles.input}
                  value={String(report.acuracidadeCliente)}
                  onChangeText={(t) =>
                    setField("acuracidadeCliente", Number(t) || "")
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
                    setField("acuracidadeTerceirizada", Number(t) || "")
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
                  onChangeText={(t) => setField("satisfacao", Number(t) || "")}
                  keyboardType="numeric"
                  maxLength={1}
                />
              </View>
            </View>
            <Text style={styles.label}>Responsável</Text>
            <TextInput
              style={styles.input}
              value={report.responsavel}
              onChangeText={(t) => setField("responsavel", t)}
            />
            {renderTimeField("Término Inventário", "terminoInventario")}

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
            <Text style={styles.sectionTitle}>Fotos</Text>
            <Text style={styles.helpText}>
              Selecione para conferência. Você precisará anexar no WhatsApp.
            </Text>
            <Pressable style={styles.buttonPhoto} onPress={pickImages}>
              <Ionicons name="images-outline" size={24} color="#2563EB" />
              <Text style={styles.btnTextSecondary}>Selecionar Fotos</Text>
            </Pressable>
            <ScrollView horizontal style={{ marginTop: 10 }}>
              {photoUris.map((u, i) => (
                <Image
                  key={i}
                  source={{ uri: u }}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 8,
                    marginRight: 8,
                    backgroundColor: "#eee",
                  }}
                />
              ))}
            </ScrollView>
          </View>

          <Pressable
            style={styles.buttonPrimary}
            onPress={() => setPreviewVisible(true)}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.btnText}>Visualizar e Enviar</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={previewVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.sectionTitle}>Pré-visualização</Text>
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
              <Pressable style={styles.buttonPrimary} onPress={handleSend}>
                <Text style={styles.btnText}>Copiar e Enviar</Text>
              </Pressable>
            </View>
            <Text
              style={{
                textAlign: "center",
                marginTop: 15,
                fontSize: 13,
                color: "#DC2626",
                fontWeight: "bold",
              }}
            >
              Lembre-se: Cole o texto e anexe as fotos no WhatsApp!
            </Text>
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
