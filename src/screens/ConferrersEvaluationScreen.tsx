import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useNavigation } from "@react-navigation/native";
import React, { useLayoutEffect, useMemo, useState } from "react";
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

import { FARMACIA_CONFIG } from "../config/evaluationConfig";
import type { ConferrerEvaluation } from "../types";
import { readFileAsCsvText } from "../utils/fileImport";
import { shareCsvFile } from "../utils/export";
import { evaluateAllConferrers } from "../utils/evaluation";
import { generateIndividualReportText } from "../utils/individualReport";
import { parseConferrersCsv } from "../utils/parsers";

const HeaderIcon = require("../../assets/images/splash-icon.png");

const EXAMPLE_CSV = `Nome,Qtde,Horas,Produtividade,Erro,%Erro,1a1,Bloco
João Silva,1250,8.5,147,18,1.44,980,270
Maria Santos,980,7.2,136,8,0.82,920,60
Pedro Lima,1100,8,137,22,2,850,250`;

export default function ConferrersEvaluationScreen() {
  const navigation = useNavigation();
  const [rawText, setRawText] = useState("");
  const [evaluations, setEvaluations] = useState<ConferrerEvaluation[]>([]);
  const [resumo, setResumo] = useState<{
    totalConferentes: number;
    totalItens: number;
    taxaMediaErro: number;
    produtividadeMedia: number;
    scoreMedio: number;
  } | null>(null);
  const [metaDinamica, setMetaDinamica] = useState<number>(0);
  const [detailModal, setDetailModal] = useState<ConferrerEvaluation | null>(
    null
  );

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/plain",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const text = await readFileAsCsvText(file.uri, file.mimeType ?? undefined);
      setRawText(text);
      Alert.alert("Arquivo carregado", `${file.name} importado. Clique em Processar.`);
    } catch (e) {
      Alert.alert("Erro", "Não foi possível ler o arquivo. Tente CSV.");
    }
  };

  const handleProcess = () => {
    const parsed = parseConferrersCsv(rawText);
    if (parsed.length === 0) {
      Alert.alert(
        "Dados inválidos",
        "Cole os dados (vírgula, ; ou tab) ou anexe CSV/Excel.\nColunas: Nome, Qtde, Horas, Produtividade, Erro, %Erro, 1a1, Bloco"
      );
      return;
    }
    const { evaluations: ev, metaDinamica: meta, resumo: res } = evaluateAllConferrers(
      parsed,
      FARMACIA_CONFIG
    );
    setEvaluations(ev);
    setMetaDinamica(meta);
    setResumo(res);
  };

  const top5 = useMemo(
    () => evaluations.slice(0, 5),
    [evaluations]
  );
  const bottom5 = useMemo(
    () => evaluations.slice(-5).reverse(),
    [evaluations]
  );
  const allAlertas = useMemo(
    () =>
      evaluations.flatMap((e) =>
        e.alertas.map((a) => ({ conferente: e.input.nome, ...a }))
      ),
    [evaluations]
  );

  const handleExportCsv = async () => {
    if (evaluations.length === 0) {
      Alert.alert("Sem dados", "Processe os dados primeiro.");
      return;
    }
    const headers = [
      "Rank",
      "Nome",
      "Score",
      "Classificação",
      "Prod/h",
      "Erro%",
      "1a1%",
      "Bloco%",
      "IRB",
      "Alertas",
    ];
    const rows = evaluations.map((e, i) => [
      i + 1,
      e.input.nome,
      e.scoreFinal,
      e.classificacaoGeral,
      e.produtividadeReal,
      e.taxaErroPercentual,
      e.percentual1a1,
      e.percentualBloco,
      e.irb,
      e.alertas.map((a) => a.mensagem).join("; ") || "-",
    ]);
    await shareCsvFile(
      `inventexpert_avaliacao_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
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
        <Text style={styles.headerTitle}>Avaliação de Conferentes</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Importar Dados</Text>
          <Text style={styles.subtitle}>
            Cole a tabela (separadores: vírgula, ponto e vírgula ou tab) ou anexe
            arquivo CSV/Excel. Colunas: Nome, Qtde, Horas, Produtividade, Erro,
            %Erro, 1a1, Bloco. Opcional: Anuência (Sim/Não).
          </Text>
          <View style={styles.importRow}>
            <Pressable onPress={handlePickFile} style={styles.btnAttach}>
              <Ionicons name="attach" size={20} color="#2563EB" />
              <Text style={styles.btnAttachText}>Anexar CSV/Excel</Text>
            </Pressable>
          </View>
          <TextInput
            value={rawText}
            onChangeText={setRawText}
            placeholder={EXAMPLE_CSV}
            placeholderTextColor="#94A3B8"
            multiline
            style={styles.textArea}
            textAlignVertical="top"
          />
          <Pressable onPress={handleProcess} style={styles.btnPrimary}>
            <Ionicons name="calculator-outline" size={20} color="#fff" />
            <Text style={styles.btnTextWhite}>Processar Avaliação</Text>
          </Pressable>
        </View>

        {resumo && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📊 Resumo do Inventário</Text>
              <View style={styles.resumoGrid}>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>{resumo.totalConferentes}</Text>
                  <Text style={styles.resumoLabel}>Conferentes</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>
                    {resumo.totalItens.toLocaleString("pt-BR")}
                  </Text>
                  <Text style={styles.resumoLabel}>Itens contados</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>{resumo.taxaMediaErro}%</Text>
                  <Text style={styles.resumoLabel}>Taxa média erro</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>
                    {resumo.produtividadeMedia}
                  </Text>
                  <Text style={styles.resumoLabel}>Prod/h média</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>{resumo.scoreMedio}</Text>
                  <Text style={styles.resumoLabel}>Score médio</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>{metaDinamica}</Text>
                  <Text style={styles.resumoLabel}>Meta dinâmica (P50)</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>⭐ Top 5 Melhores</Text>
              {top5.map((e, i) => (
                <Pressable
                  key={e.input.nome + i}
                  style={styles.rankRow}
                  onPress={() => setDetailModal(e)}
                >
                  <Text style={styles.rankBadge}>{i + 1}º</Text>
                  <Text style={styles.rankNome}>{e.input.nome}</Text>
                  <Text style={styles.rankScore}>{e.scoreFinal}</Text>
                  <Text style={styles.rankBadgeText}>{e.badge}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>🚨 Top 5 Atenção</Text>
              {bottom5.map((e, i) => (
                <Pressable
                  key={e.input.nome + (evaluations.length - i)}
                  style={styles.rankRow}
                  onPress={() => setDetailModal(e)}
                >
                  <Text style={styles.rankBadge}>{evaluations.length - i}º</Text>
                  <Text style={styles.rankNome}>{e.input.nome}</Text>
                  <Text style={styles.rankScore}>{e.scoreFinal}</Text>
                  <Text style={styles.rankBadgeText}>{e.badge}</Text>
                </Pressable>
              ))}
            </View>

            {allAlertas.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>⚠️ Alertas Críticos</Text>
                {allAlertas.slice(0, 8).map((a, i) => (
                  <View key={i} style={styles.alertaRow}>
                    <Text style={styles.alertaConferente}>{a.conferente}</Text>
                    <Text style={styles.alertaMsg}>{a.mensagem}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Todos os Conferentes</Text>
              {evaluations.map((e, i) => (
                <Pressable
                  key={e.input.nome + i}
                  style={styles.listRow}
                  onPress={() => setDetailModal(e)}
                >
                  <Text style={styles.listRank}>{i + 1}º</Text>
                  <View style={styles.listInfo}>
                    <Text style={styles.listNome}>{e.input.nome}</Text>
                    <Text style={styles.listMeta}>
                      Score: {e.scoreFinal} | {e.produtividadeReal} prod/h |{" "}
                      {e.taxaErroPercentual}% erro
                    </Text>
                  </View>
                  <Text style={styles.listBadge}>{e.badge}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={() => void handleExportCsv()} style={styles.btnExport}>
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.btnTextWhite}>Exportar CSV</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <Modal
        visible={!!detailModal}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModal(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDetailModal(null)}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            {detailModal && (
              <>
                <Text style={styles.modalTitle}>
                  {detailModal.badge} {detailModal.input.nome}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Score: {detailModal.scoreFinal} — {detailModal.classificacaoGeral}
                </Text>
                <Pressable
                  style={[styles.btnPrimary, { marginBottom: 12 }]}
                  onPress={() => {
                    if (!detailModal || !resumo) return;
                    const rank =
                      evaluations.findIndex((e) => e.input.nome === detailModal.input.nome) + 1;
                    const text = generateIndividualReportText(
                      detailModal,
                      rank,
                      evaluations.length,
                      metaDinamica,
                      resumo.produtividadeMedia,
                      resumo.taxaMediaErro
                    );
                    Linking.openURL(
                      `whatsapp://send?text=${encodeURIComponent(text)}`
                    ).catch(() =>
                      Alert.alert("Erro", "Não foi possível abrir o WhatsApp.")
                    );
                  }}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                  <Text style={styles.btnTextWhite}>Enviar ao Conferente (WhatsApp)</Text>
                </Pressable>
                <ScrollView style={styles.modalScroll}>
                  <Text style={styles.modalSection}>📈 Produtividade</Text>
                  <Text style={styles.modalText}>
                    {detailModal.input.qtde} itens em {detailModal.input.horas}h
                  </Text>
                  <Text style={styles.modalText}>
                    {detailModal.produtividadeReal} itens/h
                  </Text>

                  <Text style={styles.modalSection}>✅ Qualidade</Text>
                  <Text style={styles.modalText}>
                    Erros: {detailModal.input.erro} ({detailModal.taxaErroPercentual}%)
                  </Text>
                  <Text style={styles.modalText}>
                    Acurácia: {detailModal.acuracia}%
                  </Text>

                  <Text style={styles.modalSection}>🎯 Método</Text>
                  <Text style={styles.modalText}>
                    1a1: {detailModal.percentual1a1}% | Bloco: {detailModal.percentualBloco}%
                  </Text>
                  <Text style={styles.modalText}>
                    IRB: {detailModal.irb} ({detailModal.irbClassificacao})
                  </Text>

                  <Text style={styles.modalSection}>📊 Detalhe</Text>
                  <Text style={styles.modalText}>
                    Qualidade: {detailModal.pontosQualidade} | Produtividade:{" "}
                    {detailModal.pontosProdutividade} | Método:{" "}
                    {detailModal.pontosMetodo}
                  </Text>
                  {detailModal.bonificacoes > 0 && (
                    <Text style={styles.modalText}>
                      Bônus: +{detailModal.bonificacoes}
                    </Text>
                  )}
                  {detailModal.penalidades > 0 && (
                    <Text style={[styles.modalText, { color: "#DC2626" }]}>
                      Penalidades: -{detailModal.penalidades}
                    </Text>
                  )}
                  {detailModal.alertas.length > 0 && (
                    <>
                      <Text style={styles.modalSection}>⚠️ Alertas</Text>
                      {detailModal.alertas.map((a, i) => (
                        <Text key={i} style={[styles.modalText, { color: "#B45309" }]}>
                          • {a.mensagem}
                        </Text>
                      ))}
                    </>
                  )}
                </ScrollView>
                <Pressable
                  onPress={() => setDetailModal(null)}
                  style={styles.btnBack}
                >
                  <Text style={styles.btnTextSecondary}>Fechar</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
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
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 16,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#1E293B" },
  subtitle: { marginTop: 8, fontSize: 13, color: "#64748B" },
  importRow: { marginTop: 8 },
  btnAttach: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2563EB",
    borderStyle: "dashed",
  },
  btnAttachText: { fontSize: 14, fontWeight: "600", color: "#2563EB" },
  textArea: {
    marginTop: 12,
    minHeight: 140,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
  },
  btnPrimary: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#2563EB",
    paddingVertical: 12,
  },
  btnTextWhite: { fontSize: 14, fontWeight: "600", color: "#fff" },
  btnTextSecondary: { fontSize: 14, fontWeight: "600", color: "#334155" },
  resumoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 12,
  },
  resumoItem: {
    minWidth: "30%",
    backgroundColor: "#F1F5F9",
    padding: 12,
    borderRadius: 8,
  },
  resumoValue: { fontSize: 18, fontWeight: "bold", color: "#1E293B" },
  resumoLabel: { fontSize: 12, color: "#64748B", marginTop: 2 },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  rankBadge: { width: 36, fontSize: 14, fontWeight: "600", color: "#64748B" },
  rankNome: { flex: 1, fontSize: 15, color: "#1E293B" },
  rankScore: { fontSize: 16, fontWeight: "bold", color: "#2563EB", marginRight: 8 },
  rankBadgeText: { fontSize: 18 },
  alertaRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#FEF3C7",
    backgroundColor: "#FFFBEB",
    padding: 10,
    marginBottom: 6,
    borderRadius: 8,
  },
  alertaConferente: { fontWeight: "600", color: "#92400E" },
  alertaMsg: { fontSize: 13, color: "#B45309", marginTop: 2 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  listRank: { width: 32, fontSize: 13, color: "#64748B" },
  listInfo: { flex: 1 },
  listNome: { fontSize: 15, fontWeight: "500", color: "#1E293B" },
  listMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  listBadge: { fontSize: 16 },
  btnExport: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#059669",
    paddingVertical: 12,
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
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#1E293B" },
  modalSubtitle: { fontSize: 15, color: "#64748B", marginTop: 4 },
  modalScroll: { maxHeight: 320, marginTop: 16 },
  modalSection: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 12,
  },
  modalText: { fontSize: 14, color: "#334155", marginTop: 4 },
  btnBack: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
  },
});
