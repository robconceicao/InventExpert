import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import React, { useLayoutEffect, useMemo, useState } from "react";
import {
    Alert,
    Image,
    Linking,
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

import { CheckerFeedbackReport } from "../components/CheckerFeedbackReport";
import { INVENTORY_PROFILES } from "../config/inventoryEvalConfig";
import {
    evaluateChecker,
    sortRanking,
} from "../services/InventoryEvaluationService";
import type {
    InventoryCheckerEvaluation,
    InventoryOperationType,
} from "../types";
import { shareCsvFile, shareTextFile } from "../utils/export";
import { readFileAsCsvText } from "../utils/fileImport";
import {
    generateInventExpGerencialReportText,
    generateInventExpIndividualReportText,
} from "../utils/inventExpReports";
import { parseInventoryCheckersCsv } from "../utils/parsers";

const HeaderIcon = require("../../assets/images/splash-icon.png");

const EXAMPLE_INVENTEXP_CSV = `Nome,Qtde,Qtde1a1,Produtividade,Erro
Ana Souza,3200,2900,950,4
Bruno Lima,2800,1700,1100,12
Carlos Silva,1500,1400,780,1`;

export default function InventExpImportScreen() {
  const navigation = useNavigation();
  const [operationType, setOperationType] =
    useState<InventoryOperationType>("FARMACIA");
  const [rawText, setRawText] = useState("");
  const [evaluations, setEvaluations] = useState<InventoryCheckerEvaluation[]>(
    [],
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
      const text = await readFileAsCsvText(
        file.uri,
        file.mimeType ?? undefined,
      );
      setRawText(text);
      Alert.alert(
        "Arquivo carregado",
        `${file.name} importado. Clique em Processar Avaliação.`,
      );
    } catch (e) {
      Alert.alert("Erro", "Não foi possível ler o arquivo. Tente CSV.");
    }
  };

  const handleProcess = () => {
    const parsed = parseInventoryCheckersCsv(rawText);
    if (parsed.length === 0) {
      Alert.alert(
        "Dados inválidos",
        "Cole a tabela ou anexe CSV/Excel.\nColunas obrigatórias: Nome, Qtde, Qtde1a1, Produtividade, Erro.",
      );
      return;
    }
    const evaluated = parsed.map((item) =>
      evaluateChecker(item, operationType),
    );
    setEvaluations(sortRanking(evaluated));
  };

  const resumo = useMemo(() => {
    if (evaluations.length === 0) return null;
    const totalConferentes = evaluations.length;
    const totalItens = evaluations.reduce((s, e) => s + e.input.qtde, 0);
    const totalErros = evaluations.reduce((s, e) => s + e.input.erro, 0);
    const taxaMediaErro = totalItens > 0 ? (totalErros / totalItens) * 100 : 0;
    const produtividadeMedia =
      evaluations.reduce((s, e) => s + e.input.produtividade, 0) /
      evaluations.length;
    const scoreMedio =
      evaluations.reduce((s, e) => s + e.scoreFinal, 0) / evaluations.length;
    return {
      totalConferentes,
      totalItens,
      taxaMediaErro: Math.round(taxaMediaErro * 100) / 100,
      produtividadeMedia: Math.round(produtividadeMedia * 10) / 10,
      scoreMedio: Math.round(scoreMedio * 10) / 10,
    };
  }, [evaluations]);

  const handleExportCsv = async () => {
    if (evaluations.length === 0) {
      Alert.alert("Sem dados", "Processe os dados primeiro.");
      return;
    }
    const headers = [
      "Rank",
      "Operacao",
      "Nome",
      "Qtde",
      "Qtde1a1",
      "Produtividade_itens_h",
      "Erro",
      "Pct_Erro_%",
      "Pct_Bloco_%",
      "Score_Qualidade",
      "Score_Produtividade",
      "Score_Aderencia",
      "Score_Final",
      "Nivel",
      "Tags",
    ];
    const rows = evaluations.map((e, i) => [
      i + 1,
      e.operationType,
      e.input.nome,
      e.input.qtde,
      e.input.qtde1a1,
      e.input.produtividade,
      e.input.erro,
      e.pctErro.toFixed(2),
      e.pctBloco.toFixed(2),
      Math.round(e.scoreQualidade),
      Math.round(e.scoreProdutividade),
      Math.round(e.scoreAderencia),
      e.scoreFinal,
      e.nivel,
      e.tags.join(" | "),
    ]);
    await shareCsvFile(
      `resultado_avaliacao_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
    );
  };

  const top3 = useMemo(() => evaluations.slice(0, 3), [evaluations]);

  const radarRisco = useMemo(
    () =>
      evaluations.filter(
        (e) =>
          e.nivel === "CRITICO" ||
          e.tags.includes("🚨 Risco de Contagem Superficial"),
      ),
    [evaluations],
  );

  const profile = INVENTORY_PROFILES[operationType];

  const handleExportGerencial = async () => {
    if (!resumo || evaluations.length === 0) {
      Alert.alert("Sem dados", "Processe os dados primeiro.");
      return;
    }
    const text = generateInventExpGerencialReportText(
      operationType,
      evaluations,
      resumo,
    );
    await shareTextFile(
      `relatorio_gerencial_avaliacao_${new Date()
        .toISOString()
        .slice(0, 10)}.txt`,
      text,
      "Exportar Relatório Gerencial Avaliação",
    );
  };

  const handleSendIndividualWhatsApp = (
    ev: InventoryCheckerEvaluation,
    index: number,
  ) => {
    const text = generateInventExpIndividualReportText(
      operationType,
      ev,
      index + 1,
      evaluations.length,
    );
    const waUrl = Platform.OS === "web"
      ? `https://wa.me/?text=${encodeURIComponent(text)}`
      : `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(waUrl).catch(
      () =>
        Alert.alert(
          "Erro",
          "N\u00e3o foi poss\u00edvel abrir o WhatsApp neste dispositivo.",
        ),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
      <View style={styles.header}>
        <Image
          source={HeaderIcon}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>Avaliação - Importar CSV</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.segmentContainer}>
          {(
            [
              "FARMACIA",
              "SUPERMERCADO",
              "LOJA_GERAL",
            ] as InventoryOperationType[]
          ).map((type) => {
            const active = operationType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setOperationType(type)}
                style={[
                  styles.segmentButton,
                  active && styles.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    active && styles.segmentLabelActive,
                  ]}
                >
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Importar dados dos conferentes</Text>
          <Text style={styles.subtitle}>
            Cole a tabela (vírgula, ponto e vírgula ou tab) ou anexe arquivo
            CSV/Excel. Colunas: Nome, Qtde, Qtde1a1, Produtividade (itens/h),
            Erro (qtde).
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
            placeholder={EXAMPLE_INVENTEXP_CSV}
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
              <Text style={styles.cardTitle}>Resumo da Avaliação</Text>
              <View style={styles.resumoGrid}>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>
                    {resumo.totalConferentes}
                  </Text>
                  <Text style={styles.resumoLabel}>Conferentes</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>
                    {resumo.totalItens.toLocaleString("pt-BR")}
                  </Text>
                  <Text style={styles.resumoLabel}>Itens contados</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>
                    {resumo.taxaMediaErro}%
                  </Text>
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
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top 3 MVPs</Text>
              <View style={styles.mvpRow}>
                {top3.map((ev, index) => (
                  <View key={ev.input.nome} style={styles.mvpCard}>
                    <Text style={styles.mvpRank}>{index + 1}º</Text>
                    <Text style={styles.mvpName}>{ev.input.nome}</Text>
                    <Text style={[styles.mvpScore, { color: ev.nivelColor }]}>
                      {ev.scoreFinal}
                    </Text>
                    <Text style={styles.mvpLevel}>{ev.nivel}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ranking Avaliação</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 0.5 }]}>#</Text>
                <Text style={[styles.th, { flex: 1.7 }]}>Conferente</Text>
                <Text style={[styles.th, { flex: 0.8 }]}>Score</Text>
                <Text style={[styles.th, { flex: 0.9 }]}>% Erro</Text>
                <Text style={[styles.th, { flex: 1.1 }]}>Prod/h</Text>
                <Text style={[styles.th, { flex: 1 }]}>Bloco%</Text>
              </View>
              {evaluations.map((ev, index) => (
                <Pressable
                  key={ev.input.nome}
                  style={styles.tableRow}
                  onPress={() => handleSendIndividualWhatsApp(ev, index)}
                >
                  <Text style={[styles.tdRank, { flex: 0.5 }]}>
                    {index + 1}º
                  </Text>
                  <Text style={[styles.tdNome, { flex: 1.7 }]}>
                    {ev.input.nome}
                  </Text>
                  <Text
                    style={[
                      styles.tdScore,
                      { flex: 0.8, color: ev.nivelColor },
                    ]}
                  >
                    {ev.scoreFinal}
                  </Text>
                  <Text style={[styles.td, { flex: 0.9 }]}>
                    {ev.pctErro.toFixed(2)}%
                  </Text>
                  <Text style={[styles.td, { flex: 1.1 }]}>
                    {ev.input.produtividade}
                  </Text>
                  <Text style={[styles.td, { flex: 1 }]}>
                    {ev.pctBloco.toFixed(1)}%
                  </Text>
                </Pressable>
              ))}
            </View>

            {radarRisco.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Radar de Risco</Text>
                <Text style={styles.cardSubtitle}>
                  Conferentes com risco de contagem superficial ou classificação
                  crítica.
                </Text>
                {radarRisco.map((ev) => (
                  <View key={ev.input.nome} style={styles.riskRow}>
                    <View style={styles.riskHeader}>
                      <View
                        style={[
                          styles.riskDot,
                          { backgroundColor: ev.nivelColor },
                        ]}
                      />
                      <Text style={styles.riskName}>{ev.input.nome}</Text>
                      <Text style={styles.riskScore}>{ev.scoreFinal}</Text>
                    </View>
                    <Text style={styles.riskMeta}>
                      % Erro: {ev.pctErro.toFixed(2)}% | Bloco:{" "}
                      {ev.pctBloco.toFixed(1)}% | Prod/h:{" "}
                      {ev.input.produtividade}
                    </Text>
                    {ev.tags.length > 0 && (
                      <Text style={styles.riskTags}>{ev.tags.join(" · ")}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {evaluations[0] && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  Exemplo de recibo do conferente
                </Text>
                <CheckerFeedbackReport
                  evaluation={evaluations[0]}
                  operationType={operationType}
                />
              </View>
            )}

            <View style={styles.exportRow}>
              <Pressable
                onPress={() => void handleExportCsv()}
                style={styles.btnExport}
              >
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.btnTextWhite}>Exportar CSV Avaliação</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleExportGerencial()}
                style={[styles.btnExport, { backgroundColor: "#4f46e5" }]}
              >
                <Ionicons name="document-text-outline" size={20} color="#fff" />
                <Text style={styles.btnTextWhite}>Relatório Gerencial</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#1d4ed8",
  },
  headerLogo: {
    width: 36,
    height: 36,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#1d4ed8",
  },
  segmentLabel: {
    fontSize: 12,
    color: "#1e293b",
    fontWeight: "500",
  },
  segmentLabelActive: {
    color: "#ffffff",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
  },
  importRow: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 8,
  },
  btnAttach: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#EFF6FF",
  },
  btnAttachText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#2563EB",
  },
  textArea: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    minHeight: 120,
    fontSize: 13,
    fontFamily: "System",
    color: "#0f172a",
    backgroundColor: "#F8FAFC",
  },
  btnPrimary: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnTextWhite: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  resumoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  resumoItem: {
    width: "30%",
    minWidth: 96,
  },
  resumoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  resumoLabel: {
    fontSize: 11,
    color: "#64748b",
  },
  mvpRow: {
    flexDirection: "row",
    gap: 10,
  },
  mvpCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    gap: 4,
  },
  mvpRank: {
    fontSize: 12,
    color: "#64748b",
  },
  mvpName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
  },
  mvpScore: {
    fontSize: 18,
    fontWeight: "700",
  },
  mvpLevel: {
    fontSize: 11,
    color: "#475569",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 4,
    marginBottom: 4,
  },
  th: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  td: {
    fontSize: 11,
    color: "#475569",
  },
  tdRank: {
    fontSize: 11,
    color: "#64748b",
  },
  tdNome: {
    fontSize: 12,
    color: "#0f172a",
  },
  tdScore: {
    fontSize: 12,
    fontWeight: "600",
  },
  riskRow: {
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    padding: 10,
    marginTop: 8,
    gap: 4,
  },
  riskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  riskName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#7f1d1d",
  },
  riskScore: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7f1d1d",
  },
  riskMeta: {
    fontSize: 11,
    color: "#7f1d1d",
  },
  riskTags: {
    fontSize: 11,
    color: "#7f1d1d",
    fontStyle: "italic",
  },
  exportRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  btnExport: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#059669",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
