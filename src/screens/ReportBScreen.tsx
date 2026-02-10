import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
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
import { enqueueSyncItem, syncQueue } from "../services/sync";
import type { ReportA, ReportB } from "../types";
import { formatReportB } from "../utils/parsers";

const HeaderIcon = require("../../assets/images/splash-icon.png");
const REPORT_A_KEY = "inventexpert:reportA";
const REPORT_B_KEY = "inventexpert:reportB";
const HISTORY_KEY = "inventexpert:reportB:history";

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
  const navigation = useNavigation();
  const [report, setReport] = useState<ReportB>(initialState);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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

  const handleSendText = () => {
    const msg = formatReportB(report);
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`);
  };

  const handleShareImages = async () => {
    if (photoUris.length === 0) {
      Alert.alert("Atenção", "Nenhuma foto selecionada.");
      return;
    }
    const lastPhoto = photoUris[photoUris.length - 1];
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(lastPhoto);
    } else {
      Alert.alert("Erro", "Compartilhamento não suportado.");
    }
  };

  const handleArchiveAndClear = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem(HISTORY_KEY);
      const history = storedHistory ? JSON.parse(storedHistory) : [];
      history.push({ savedAt: new Date().toISOString(), report });
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      await enqueueSyncItem("reportB", { report });

      setReport(initialState);
      setPhotoUris([]);
      Alert.alert("Sucesso", "Resumo arquivado e tela limpa.");
      void syncQueue();
    } catch {
      Alert.alert("Erro", "Falha ao arquivar.");
    }
  };

  const handleClearOnly = () => {
    Alert.alert("Limpar", "Deseja apagar sem salvar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar",
        style: "destructive",
        onPress: () => {
          setReport(initialState);
          setPhotoUris([]);
        },
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
        <Text style={styles.headerTitle}>Resumo Final</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* SESSÕES 1 a 6 - MANTENHA O CÓDIGO EXISTENTE DOS INPUTS AQUI */}
          {/* Para brevidade, estou assumindo que você manterá os inputs que já funcionam */}
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
            {/* ... (Continue com os outros campos da Seção 1) */}
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

          {/* ... SESSÕES 2, 3, 4, 5 (CÓDIGO DEVE SER O MESMO DO ARQUIVO ANTERIOR) ... */}
          {/* Vou colocar a Seção 6 completa aqui para garantir o estilo do rádio */}

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
              Selecione as fotos (Documento Assinado, etc)
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
            <Text style={styles.btnText}>Continuar para Envio</Text>
          </Pressable>

          <View style={styles.actionRow}>
            <Pressable
              style={[
                styles.btnSecondary,
                { backgroundColor: "#FEE2E2", flex: 1, marginRight: 8 },
              ]}
              onPress={handleClearOnly}
            >
              <Text style={[styles.btnTextSecondary, { color: "#DC2626" }]}>
                Limpar
              </Text>
            </Pressable>
            <Pressable
              style={[styles.btnSecondary, { flex: 1, marginLeft: 8 }]}
              onPress={handleArchiveAndClear}
            >
              <Text style={styles.btnTextSecondary}>Arquivar e Limpar</Text>
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
              2. Volte e clique para enviar as Fotos.
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
              onPress={handleShareImages}
            >
              <Ionicons
                name="images"
                size={20}
                color="#fff"
                style={{ marginRight: 10 }}
              />
              <Text style={styles.btnText}>2º Enviar Fotos</Text>
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
  actionRow: {
    flexDirection: "row",
    marginTop: 16,
    justifyContent: "space-between",
  },
  btnSecondary: {
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
    paddingVertical: 12,
  },
  // ESTILOS QUE FALTAVAM:
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
});
