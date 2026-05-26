import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import React, { useMemo, useState } from "react";
import {
    Alert,
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
    getDistribuicaoNiveis,
} from "../services/InventoryEvaluationService";
import { getCheckerCurrentLevel } from "../services/CheckerDBService";
import type {
    InventoryCheckerEvaluation,
    InventoryOperationType,
    ModalidadeContrato,
    SectionAccuracyRecord,
} from "../types";
import { shareCsvFile, shareTextFile } from "../utils/export";
import { readFileAsCsvText } from "../utils/fileImport";
import {
    generateInventExpGerencialReportText,
    generateInventExpIndividualReportText,
} from "../utils/inventExpReports";
import { parseInventoryCheckersCsv, parseTagsExtended } from "../utils/parsers";


const EXAMPLE_INVENTEXP_CSV = `NOME DO CONFERENTE;PRODUTIVIDADE;QTDE. VOLUMES;1a1;BLOCO;HORAS ESTIMADAS;ERRO;% ERRO
AMANDA DE OLIVEIRA P...;395,33;752;0;18;1,9;13;1,73%`;

const EXAMPLE_TAGS_CSV = `Nome;Qtd(A1)
AMANDA DE OLIVEIRA P...;15
CAMILA FERREIRA;-5`;

export default function InventExpImportScreen() {
  const [operationType, setOperationType] =
    useState<InventoryOperationType>("FARMACIA");
  const [rawText, setRawText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [totalPecas, setTotalPecas] = useState("");
  const [duracaoReal, setDuracaoReal] = useState("");
  const [evaluations, setEvaluations] = useState<InventoryCheckerEvaluation[]>([]);
  const [sectionAccuracy, setSectionAccuracy] = useState<SectionAccuracyRecord[]>([]);
  const [isExtendedTags, setIsExtendedTags] = useState(false);
  /** Modalidade de contrato padrão da operação (aplicada a todos os conferentes processados) */
  const [modalidadeContrato, setModalidadeContrato] = useState<ModalidadeContrato>("CLT");


  const handlePickFile = async (type: 'prod' | 'tags') => {
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
      if (type === 'prod') setRawText(text);
      else setTagsText(text);
      Alert.alert(
        "Arquivo carregado",
        `${file.name} importado para ${type === 'prod' ? 'Produtividade' : 'Tags'}.`,
      );
    } catch (e) {
      Alert.alert("Erro", "Não foi possível ler o arquivo.");
    }
  };

  const handleProcess = async () => {
    const parsed = parseInventoryCheckersCsv(rawText);
    const tagsResult = parseTagsExtended(tagsText);

    if (parsed.length === 0) {
      Alert.alert(
        "Dados inválidos",
        "Cole a tabela ou anexe CSV/Excel de Produtividade.",
      );
      return;
    }
    const pecas = parseInt(totalPecas.replace(/\D/g, "")) || 0;
    const duracao = parseFloat(duracaoReal.replace(",", ".")) || 5;
    const totalConferentes = parsed.length;

    const parsedWithExp = await Promise.all(
      parsed.map(async (item) => {
        const exp = await getCheckerCurrentLevel(item.nome);
        const nomeKey = item.nome.toLowerCase().trim();
        const tagsData = tagsResult.porColaborador[nomeKey] || {
          itensPulados: 0, itensDuplicados: 0, erroSecao: undefined, numSecoes: undefined,
        };
        return {
          ...item,
          experiencia: exp,
          itensPulados: tagsData.itensPulados,
          itensDuplicados: tagsData.itensDuplicados,
          erroSecao: tagsResult.isExtended ? tagsData.erroSecao : undefined,
          numSecoes: tagsResult.isExtended ? tagsData.numSecoes : undefined,
          modalidadeContrato,
        };
      })
    );

    const evaluated = parsedWithExp.map((item) =>
      evaluateChecker(item, operationType, pecas, duracao, totalConferentes),
    );
    setEvaluations(sortRanking(evaluated));

    // Salva dados de acurácia de seções quando formato estendido
    if (tagsResult.isExtended && tagsResult.porArea.length > 0) {
      setSectionAccuracy(tagsResult.porArea);
      setIsExtendedTags(true);
    } else {
      setSectionAccuracy([]);
      setIsExtendedTags(false);
    }
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
    const dist = getDistribuicaoNiveis(evaluations);
    return {
      totalConferentes,
      totalItens,
      taxaMediaErro: Math.round(taxaMediaErro * 100) / 100,
      produtividadeMedia: Math.round(produtividadeMedia * 10) / 10,
      scoreMedio: Math.round(scoreMedio * 10) / 10,
      dist,
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
      undefined,
      isExtendedTags ? sectionAccuracy : undefined,
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

          {/* Seletor de Modalidade de Contrato */}
          <Text style={[styles.label, { marginBottom: 6 }]}>Modalidade de Contrato</Text>
          <Text style={[styles.subtitle, { marginTop: 0, marginBottom: 8 }]}>
            Define o tom do relatório individual enviado via WhatsApp.
          </Text>
          <View style={styles.modalidadeRow}>
            {(["CLT", "INTERMITENTE", "FREELANCE"] as ModalidadeContrato[]).map((m) => {
              const isActive = modalidadeContrato === m;
              const colors: Record<ModalidadeContrato, string> = {
                CLT: "#2563eb",
                INTERMITENTE: "#059669",
                FREELANCE: "#f59e0b",
              };
              const color = colors[m];
              return (
                <Pressable
                  key={m}
                  onPress={() => setModalidadeContrato(m)}
                  style={[
                    styles.modalidadeBtn,
                    isActive && { backgroundColor: color, borderColor: color },
                  ]}
                >
                  <Text style={[
                    styles.modalidadeBtnText,
                    isActive && { color: "#fff" },
                  ]}>
                    {m === "INTERMITENTE" ? "INTERM." : m}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {modalidadeContrato === "FREELANCE" && (
            <View style={styles.freelanceBanner}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#92400e" />
              <Text style={styles.freelanceBannerText}>
                Relatório técnico informativo — sem metas obrigatórias, sem penalidades e sem direcionamentos imperativos.
              </Text>
            </View>
          )}
          <View style={styles.importRow}>
            <View style={{flex: 1}}>
              <Text style={styles.label}>Total de Peças</Text>
              <TextInput value={totalPecas} onChangeText={setTotalPecas} placeholder="Ex: 15000" keyboardType="numeric" style={styles.input} />
            </View>
            <View style={{flex: 1, marginLeft: 12}}>
              <Text style={styles.label}>Duração (horas)</Text>
              <TextInput value={duracaoReal} onChangeText={setDuracaoReal} placeholder="Ex: 5.5" keyboardType="numeric" style={styles.input} />
            </View>
          </View>
          <View style={styles.importRow}>
            <Pressable onPress={() => handlePickFile('prod')} style={styles.btnAttach}>
              <Ionicons name="attach" size={20} color="#2563EB" />
              <Text style={styles.btnAttachText}>Anexar Produtividade</Text>
            </Pressable>
            <Pressable onPress={() => handlePickFile('tags')} style={[styles.btnAttach, { marginLeft: 10 }]}>
              <Ionicons name="attach" size={20} color="#059669" />
              <Text style={[styles.btnAttachText, { color: "#059669" }]}>Anexar Tags (Omissão/Excesso)</Text>
            </Pressable>
          </View>
          <Text style={styles.label}>1. Produtividade (Geral)</Text>
          <TextInput
            value={rawText}
            onChangeText={setRawText}
            placeholder={EXAMPLE_INVENTEXP_CSV}
            placeholderTextColor="#94A3B8"
            multiline
            style={styles.textArea}
            textAlignVertical="top"
          />
          <Text style={[styles.label, { marginTop: 12 }]}>2. Produtividade Tags (Qtd A1)</Text>
          <TextInput
            value={tagsText}
            onChangeText={setTagsText}
            placeholder={EXAMPLE_TAGS_CSV}
            placeholderTextColor="#94A3B8"
            multiline
            style={[styles.textArea, { minHeight: 80 }]}
            textAlignVertical="top"
          />
          <Pressable onPress={() => void handleProcess()} style={styles.btnPrimary}>
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
                  <Text style={styles.resumoValue}>{resumo.produtividadeMedia}</Text>
                  <Text style={styles.resumoLabel}>Prod/h média</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>{resumo.scoreMedio}</Text>
                  <Text style={styles.resumoLabel}>Score médio</Text>
                </View>
              </View>
              {/* Pills de distribuição de performance */}
              {resumo.dist && (
                <View style={styles.distRow}>
                  {resumo.dist.EXCELENTE > 0 && (
                    <View style={[styles.distPill, { backgroundColor: "#16a34a" }]}>
                      <Text style={styles.distPillText}>
                        {resumo.dist.EXCELENTE} EXCELENTE
                      </Text>
                    </View>
                  )}
                  {resumo.dist.BOM > 0 && (
                    <View style={[styles.distPill, { backgroundColor: "#2563eb" }]}>
                      <Text style={styles.distPillText}>{resumo.dist.BOM} BOM</Text>
                    </View>
                  )}
                  {resumo.dist.ATENCAO > 0 && (
                    <View style={[styles.distPill, { backgroundColor: "#f97316" }]}>
                      <Text style={styles.distPillText}>
                        {resumo.dist.ATENCAO} ATENÇÃO
                      </Text>
                    </View>
                  )}
                  {resumo.dist.CRITICO > 0 && (
                    <View style={[styles.distPill, { backgroundColor: "#dc2626" }]}>
                      <Text style={styles.distPillText}>
                        {resumo.dist.CRITICO} CRÍTICO
                      </Text>
                    </View>
                  )}
                </View>
              )}
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
                <Text style={[styles.th, { flex: 1.5 }]}>Conferente</Text>
                <Text style={[styles.th, { flex: 0.7 }]}>Score</Text>
                <Text style={[styles.th, { flex: 0.8 }]}>% Erro</Text>
                <Text style={[styles.th, { flex: 0.9 }]}>Prod/h</Text>
                {isExtendedTags && (
                  <Text style={[styles.th, { flex: 0.8 }]}>Err.Seç</Text>
                )}
              </View>
              {evaluations.map((ev, index) => (
                <Pressable
                  key={ev.input.nome}
                  style={styles.tableRow}
                  onPress={() => handleSendIndividualWhatsApp(ev, index)}
                >
                  <Text style={[styles.tdRank, { flex: 0.5 }]}>{index + 1}º</Text>
                  <Text style={[styles.tdNome, { flex: 1.5 }]}>{ev.input.nome}</Text>
                  <Text style={[styles.tdScore, { flex: 0.7, color: ev.nivelColor }]}>
                    {ev.scoreFinal}
                  </Text>
                  <Text style={[styles.td, { flex: 0.8 }]}>
                    {ev.pctErro.toFixed(2)}%
                  </Text>
                  <Text style={[styles.td, { flex: 0.9 }]}>
                    {ev.input.produtividade}
                  </Text>
                  {isExtendedTags && (
                    <Text style={[
                      styles.td,
                      { flex: 0.8, color: ev.icsi !== undefined && ev.icsi < 0.5 ? "#f97316" : "#475569" }
                    ]}>
                      {ev.input.erroSecao ?? "-"}
                    </Text>
                  )}
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
                <Text style={styles.cardTitle}>Exemplo de recibo do conferente</Text>
                <CheckerFeedbackReport
                  evaluation={evaluations[0]}
                  operationType={operationType}
                />
              </View>
            )}

            {/* Card Mapa de Acurácia de Seções */}
            {isExtendedTags && sectionAccuracy.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🇳🇪 Mapa de Acurácia de Seções</Text>
                <Text style={styles.cardSubtitle}>
                  Acurácia = 1 − (|Σ Ajuste| ÷ Total Contado). Ordenado do mais crítico ao perfeito.
                </Text>
                {sectionAccuracy.map((s) => {
                  const isRisk = s.acuracidade < 97.5;
                  const isOk   = s.acuracidade >= 99;
                  const dotColor = s.acuracidade === 100 ? "#16a34a" :
                                   isOk ? "#2563eb" :
                                   isRisk ? "#dc2626" : "#f97316";
                  return (
                    <View key={s.area} style={[
                      styles.sectionRow,
                      isRisk && { backgroundColor: "#fef2f2" },
                    ]}>
                      <View style={styles.sectionHeader}>
                        <View style={[styles.sectionDot, { backgroundColor: dotColor }]} />
                        <Text style={styles.sectionName}>{s.area}</Text>
                        <Text style={[styles.sectionAcc, { color: dotColor }]}>
                          {s.acuracidade.toFixed(2)}%
                        </Text>
                      </View>
                      <View style={styles.sectionMeta}>
                        <Text style={styles.sectionMetaText}>
                          Contado: {s.totalC1.toFixed(0)}
                        </Text>
                        <Text style={styles.sectionMetaText}>
                          Ajuste: {s.ajusteAbsoluto.toFixed(0)}
                        </Text>
                        <Text style={[styles.sectionMetaText, {
                          color: s.ajusteLiquido < 0 ? "#dc2626" : s.ajusteLiquido > 0 ? "#f97316" : "#64748b"
                        }]}>
                          Saldo: {s.ajusteLiquido >= 0 ? "+" : ""}{s.ajusteLiquido.toFixed(0)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
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
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#fff",
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
  // Pills de distribuição de performance
  distRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  distPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  distPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  // Mapa de Seções
  sectionRow: {
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
    marginTop: 6,
    gap: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  sectionAcc: {
    fontSize: 13,
    fontWeight: "700",
  },
  sectionMeta: {
    flexDirection: "row",
    gap: 12,
    marginLeft: 16,
  },
  sectionMetaText: {
    fontSize: 11,
    color: "#64748b",
  },
  // Modalidade de Contrato
  modalidadeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  modalidadeBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
  },
  modalidadeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  freelanceBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  freelanceBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#92400e",
    lineHeight: 18,
  },
});

