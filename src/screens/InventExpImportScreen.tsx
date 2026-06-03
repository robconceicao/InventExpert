import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CheckerFeedbackReport } from "../components/CheckerFeedbackReport";
import { useInventExpEvaluations } from "../hooks/inventExp/useInventExpEvaluations";
import { useInventExpExport } from "../hooks/inventExp/useInventExpExport";
import { useInventExpImport } from "../hooks/inventExp/useInventExpImport";
import type { RootTabParamList } from "../navigation/RootTabs";
import type {
  InventoryCheckerEvaluation,
  InventoryOperationType,
  SectionAccuracyRecord,
} from "../types";

const EXAMPLE_INVENTEXP_CSV = `Capa;Matrícula;Nome do Colaborador;Qtde;1a. Coleta;Ult. Coleta;Horas;Produtividade;Erro (Qtde);% (Erro/Qtd)
0001;12345678901;AMANDA DE OLIVEIRA;752;01/01/2026 08:00;01/01/2026 10:00;1,9;395,33;13;1,73%`;

const EXAMPLE_TAGS_CSV = `Nome;Qtd(A1)
AMANDA DE OLIVEIRA P...;15
CAMILA FERREIRA;-5`;

export default function InventExpImportScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const {
    operationType,
    setOperationType,
    rawText,
    setRawText,
    tagsText,
    setTagsText,
    totalPecas,
    setTotalPecas,
    duracaoReal,
    setDuracaoReal,
    evaluations,
    sectionAccuracy,
    isExtendedTags,
    processing,
    previewProd,
    previewTags,
    handlePickFile,
    handleProcess,
  } = useInventExpImport();

  const {
    resumo,
    top3,
    radarRisco,
    getModalidade,
    cycleModalidade,
    MODALIDADE_COLOR,
    MODALIDADE_LABEL,
  } = useInventExpEvaluations(evaluations, operationType, setOperationType);

  const {
    handleExportCsv,
    handleExportGerencial,
    handleExportGerencialPdf,
    showIndividualReportOptions,
    handleSendAllWhatsApp,
  } = useInventExpExport(
    evaluations,
    operationType,
    resumo,
    sectionAccuracy,
    isExtendedTags,
    getModalidade,
  );

  // Helper for fuzzy name matching (used when matching tags and leader)
  const matchNomeFuzzy = (nomeProd: string, nomeTag: string): boolean => {
    const a = nomeProd.toLowerCase().trim();
    const b = nomeTag.toLowerCase().trim();
    if (a === b) return true;
    const MIN = 12;
    if (a.length < MIN || b.length < MIN) return a === b;
    return a.startsWith(b.slice(0, MIN)) || b.startsWith(a.slice(0, MIN));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable
          onPress={() => navigation.navigate("InventExpEvolution")}
          style={styles.btnEvolucao}
        >
          <Ionicons name="trending-up-outline" size={18} color="#1d4ed8" />
          <Text style={styles.btnEvolucaoText}>
            Ver evolução (diário / quinzenal / mensal)
          </Text>
        </Pressable>

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
            Cole ou anexe o Relatório de Produtividade (CSV/Excel). Reconhece
            Nome do Colaborador, Qtde, Horas, Produtividade, Erro (Qtde), 1a1 e
            BLOCO — ou formato simplificado com as mesmas métricas.
          </Text>

          <View style={styles.importRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Total de Peças</Text>
              <TextInput
                value={totalPecas}
                onChangeText={setTotalPecas}
                placeholder="Ex: 15000"
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.label}>Duração (horas)</Text>
              <TextInput
                value={duracaoReal}
                onChangeText={setDuracaoReal}
                placeholder="Ex: 5.5 ou 5:30 (horas)"
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>
          <View style={styles.importRow}>
            <Pressable
              onPress={() => handlePickFile("prod")}
              style={styles.btnAttach}
            >
              <Ionicons name="attach" size={20} color="#2563EB" />
              <Text style={styles.btnAttachText}>Anexar Produtividade</Text>
            </Pressable>
            <Pressable
              onPress={() => handlePickFile("tags")}
              style={[styles.btnAttach, { marginLeft: 10 }]}
            >
              <Ionicons name="attach" size={20} color="#059669" />
              <Text style={[styles.btnAttachText, { color: "#059669" }]}>
                Anexar Tags (Omissão/Excesso)
              </Text>
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
          {previewProd !== null && (
            <Text
              style={
                previewProd.count > 0 ? styles.previewOk : styles.previewWarn
              }
            >
              {previewProd.count > 0
                ? `✅ ${previewProd.count} conferente(s) detectado(s) na produtividade`
                : "⚠️ Nenhum conferente detectado — confira o cabeçalho e o separador"}
            </Text>
          )}
          <Text style={[styles.label, { marginTop: 12 }]}>
            2. Produtividade Tags (Qtd A1)
          </Text>
          <TextInput
            value={tagsText}
            onChangeText={setTagsText}
            placeholder={EXAMPLE_TAGS_CSV}
            placeholderTextColor="#94A3B8"
            multiline
            style={[styles.textArea, { minHeight: 80 }]}
            textAlignVertical="top"
          />
          {previewTags !== null && (
            <Text
              style={
                previewTags.count > 0 ? styles.previewOk : styles.previewWarn
              }
            >
              {previewTags.count > 0
                ? `✅ ${previewTags.count} colaborador(es) nas tags${previewTags.extended ? " (formato por seção)" : ""}`
                : "⚠️ Nenhuma tag detectada — opcional se não houver arquivo de omissão/excesso"}
            </Text>
          )}
          <Pressable
            onPress={() => void handleProcess()}
            style={styles.btnPrimary}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="calculator-outline" size={20} color="#fff" />
            )}
            <Text style={styles.btnTextWhite}>
              {processing ? "Processando…" : "Processar Avaliação"}
            </Text>
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
              {/* Pills de distribuição de performance */}
              {resumo.dist && (
                <View style={styles.distRow}>
                  {resumo.dist.EXCELENTE > 0 && (
                    <View
                      style={[styles.distPill, { backgroundColor: "#16a34a" }]}
                    >
                      <Text style={styles.distPillText}>
                        {resumo.dist.EXCELENTE} EXCELENTE
                      </Text>
                    </View>
                  )}
                  {resumo.dist.BOM > 0 && (
                    <View
                      style={[styles.distPill, { backgroundColor: "#2563eb" }]}
                    >
                      <Text style={styles.distPillText}>
                        {resumo.dist.BOM} BOM
                      </Text>
                    </View>
                  )}
                  {resumo.dist.ATENCAO > 0 && (
                    <View
                      style={[styles.distPill, { backgroundColor: "#f97316" }]}
                    >
                      <Text style={styles.distPillText}>
                        {resumo.dist.ATENCAO} ATENÇÃO
                      </Text>
                    </View>
                  )}
                  {resumo.dist.CRITICO > 0 && (
                    <View
                      style={[styles.distPill, { backgroundColor: "#dc2626" }]}
                    >
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
                {top3.map((ev: InventoryCheckerEvaluation, index: number) => (
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
              <Text style={styles.rankingHint}>
                Toque no ícone WhatsApp ou na linha para escolher: texto
                completo, resumo ou PDF.
              </Text>
              {evaluations.length > 1 && (
                <Pressable
                  onPress={handleSendAllWhatsApp}
                  style={styles.btnSendAll}
                >
                  <Text style={styles.btnSendAllText}>
                    Enviar resumo para todos ({evaluations.length})
                  </Text>
                </Pressable>
              )}
              {/* Legenda de modalidade */}
              <View style={styles.modalidadeLegenda}>
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color="#64748b"
                />
                <Text style={styles.modalidadeLegendaText}>
                  Toque no badge colorido para alternar o tipo de contrato de
                  cada pessoa antes de enviar o relatório individual.
                </Text>
              </View>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 0.4 }]}>#</Text>
                <Text style={[styles.th, { flex: 1.4 }]}>Conferente</Text>
                <Text style={[styles.th, { flex: 0.6 }]}>Score</Text>
                <Text style={[styles.th, { flex: 0.7 }]}>% Erro</Text>
                <Text style={[styles.th, { flex: 0.7 }]}>Contrato</Text>
                {isExtendedTags && (
                  <Text style={[styles.th, { flex: 0.7 }]}>Err.Seç</Text>
                )}
                <Text style={[styles.th, { flex: 0.5 }]}></Text>
              </View>
              {evaluations.map(
                (ev: InventoryCheckerEvaluation, index: number) => {
                  const modalidade = getModalidade(ev.input.nome);
                  const badgeColor = MODALIDADE_COLOR[modalidade];
                  const badgeLabel = MODALIDADE_LABEL[modalidade];
                  return (
                    <Pressable
                      key={ev.input.nome}
                      onPress={() => showIndividualReportOptions(ev, index)}
                      style={styles.tableRow}
                    >
                      <Text style={[styles.tdRank, { flex: 0.4 }]}>
                        {index + 1}º
                      </Text>
                      <Text
                        style={[styles.tdNome, { flex: 1.4 }]}
                        numberOfLines={1}
                      >
                        {ev.input.nome}
                      </Text>
                      <Text
                        style={[
                          styles.tdScore,
                          { flex: 0.6, color: ev.nivelColor },
                        ]}
                      >
                        {ev.scoreFinal}
                      </Text>
                      <Text style={[styles.td, { flex: 0.7 }]}>
                        {ev.pctErro.toFixed(2)}%
                      </Text>
                      {/* Badge clicável de modalidade de contrato */}
                      <Pressable
                        onPress={() => cycleModalidade(ev.input.nome)}
                        style={[
                          styles.modalidadeBadge,
                          { backgroundColor: badgeColor, flex: 0.7 },
                        ]}
                      >
                        <Text style={styles.modalidadeBadgeText}>
                          {badgeLabel}
                        </Text>
                      </Pressable>
                      {isExtendedTags && (
                        <Text
                          style={[
                            styles.td,
                            {
                              flex: 0.7,
                              color:
                                ev.icsi !== undefined && ev.icsi < 0.5
                                  ? "#f97316"
                                  : "#475569",
                            },
                          ]}
                        >
                          {ev.input.erroSecao ?? "-"}
                        </Text>
                      )}
                      {/* Botão de envio individual */}
                      <View
                        style={{
                          flex: 0.5,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name="logo-whatsapp"
                          size={20}
                          color="#25D366"
                        />
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color="#94a3b8"
                        />
                      </View>
                    </Pressable>
                  );
                },
              )}
            </View>

            {radarRisco.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Radar de Risco</Text>
                <Text style={styles.cardSubtitle}>
                  Conferentes com risco de contagem superficial ou classificação
                  crítica.
                </Text>
                {radarRisco.map((ev: InventoryCheckerEvaluation) => (
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

            {/* Card Mapa de Acurácia de Seções */}
            {isExtendedTags && sectionAccuracy.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  🇳🇪 Mapa de Acurácia de Seções
                </Text>
                <Text style={styles.cardSubtitle}>
                  Acurácia = 1 − (|Σ Ajuste| ÷ Total Contado). Ordenado do mais
                  crítico ao perfeito.
                </Text>
                {sectionAccuracy.map((s: SectionAccuracyRecord) => {
                  const isRisk = s.acuracidade < 97.5;
                  const isOk = s.acuracidade >= 99;
                  const dotColor =
                    s.acuracidade === 100
                      ? "#16a34a"
                      : isOk
                        ? "#2563eb"
                        : isRisk
                          ? "#dc2626"
                          : "#f97316";
                  return (
                    <View
                      key={s.area}
                      style={[
                        styles.sectionRow,
                        isRisk && { backgroundColor: "#fef2f2" },
                      ]}
                    >
                      <View style={styles.sectionHeader}>
                        <View
                          style={[
                            styles.sectionDot,
                            { backgroundColor: dotColor },
                          ]}
                        />
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
                        <Text
                          style={[
                            styles.sectionMetaText,
                            {
                              color:
                                s.ajusteLiquido < 0
                                  ? "#dc2626"
                                  : s.ajusteLiquido > 0
                                    ? "#f97316"
                                    : "#64748b",
                            },
                          ]}
                        >
                          Saldo: {s.ajusteLiquido >= 0 ? "+" : ""}
                          {s.ajusteLiquido.toFixed(0)}
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
                <Text style={styles.btnTextWhite}>Exportar CSV</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleExportGerencial()}
                style={[styles.btnExport, { backgroundColor: "#4f46e5" }]}
              >
                <Ionicons name="document-text-outline" size={20} color="#fff" />
                <Text style={styles.btnTextWhite}>Gerencial (texto)</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => void handleExportGerencialPdf()}
              style={[
                styles.btnExport,
                { backgroundColor: "#7c3aed", marginTop: 0 },
              ]}
            >
              <Ionicons name="document-outline" size={20} color="#fff" />
              <Text style={styles.btnTextWhite}>Gerencial (PDF)</Text>
            </Pressable>
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
  btnEvolucao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#eff6ff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  btnEvolucaoText: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  btnSendAll: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    marginBottom: 8,
  },
  btnSendAllText: { fontSize: 12, color: "#059669", fontWeight: "600" },
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
  previewOk: {
    fontSize: 12,
    color: "#059669",
    marginTop: 4,
  },
  previewWarn: {
    fontSize: 12,
    color: "#d97706",
    marginTop: 4,
  },
  rankingHint: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
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
  // Modalidade de Contrato — badge individual por linha do ranking
  modalidadeLegenda: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  modalidadeLegendaText: {
    flex: 1,
    fontSize: 11,
    color: "#64748b",
    lineHeight: 16,
  },
  modalidadeBadge: {
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  modalidadeBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
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
