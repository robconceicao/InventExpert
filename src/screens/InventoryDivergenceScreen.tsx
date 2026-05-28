import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { readFileAsCsvText } from "../utils/fileImport";
import {
  type InventoryImportResult,
  type ProductVariance,
  InventoryImportRegistry,
  crossReferenceInventory,
} from "../utils/inventoryImportParsers";
import { shareCsvFile } from "../utils/export";

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

interface ParsedOperator {
  id: string;
  name: string;
  role?: string;
  cpf?: string;
}

type TabKey = "resultado_final" | "resumo" | "perdas" | "sobras" | "secoes" | "conferentes";
type FilterStatus = "TODOS" | "PERDA" | "SOBRA" | "OK";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCadFun(text: string): ParsedOperator[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const ops: ParsedOperator[] = [];
  // tenta formato MATRICULA|NOME|RG|CPF|CARGO
  const hasHeader = lines[0]?.toLowerCase().includes("matricula");
  const start = hasHeader ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const p = lines[i].split("|");
    if (p.length >= 2) {
      ops.push({
        id:   (p[0] ?? "").trim(),
        name: (p[1] ?? "").trim(),
        cpf:  (p[3] ?? "").trim() || undefined,
        role: (p[4] ?? "").trim() || undefined,
      });
    }
  }
  return ops;
}

function parseAgentes(text: string): ParsedOperator[] {
  const lines = text.split("\n").filter((l) => l.trim());
  return lines.map((l) => ({
    id:   l.substring(0, 6).trim(),
    name: l.substring(6).trim(),
  }));
}

function fmtBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

// ─── Componentes internos ─────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, color, icon,
}: { label: string; value: string; sub?: string; color: string; icon: string }) {
  return (
    <View style={[styles.metricCard, { borderLeftColor: color }]}>
      <View style={styles.metricTop}>
        <Ionicons name={icon as any} size={18} color={color} />
        <Text style={[styles.metricLabel, { color }]}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function FileSlot({
  label, hint, required, loaded, onPick,
}: { label: string; hint: string; required?: boolean; loaded: boolean; onPick: () => void }) {
  return (
    <Pressable
      onPress={onPick}
      style={[styles.fileSlot, loaded && styles.fileSlotLoaded]}
    >
      <Ionicons
        name={loaded ? "checkmark-circle" : "document-attach-outline"}
        size={20}
        color={loaded ? "#059669" : "#64748b"}
      />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.fileSlotLabel, loaded && { color: "#059669" }]}>
          {label}
          {required && !loaded && <Text style={{ color: "#ef4444" }}> *</Text>}
        </Text>
        <Text style={styles.fileSlotHint}>{hint}</Text>
      </View>
      {!loaded && (
        <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
      )}
    </Pressable>
  );
}

function VarianceRow({ v }: { v: ProductVariance }) {
  const isLoss = v.status === "PERDA";
  const color  = isLoss ? "#ef4444" : "#059669";
  return (
    <View style={styles.varRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.varDesc} numberOfLines={1}>{v.description}</Text>
        <Text style={styles.varMeta}>
          {v.family || "—"}  ·  Seç {v.section || "—"}
        </Text>
      </View>
      <View style={styles.varRight}>
        <Text style={[styles.varDiff, { color }]}>
          {v.difference > 0 ? "+" : ""}{fmtNum(v.difference)} un
        </Text>
        <Text style={[styles.varValue, { color }]}>
          {v.valueVariance > 0 ? "+" : ""}{fmtBrl(v.valueVariance)}
        </Text>
      </View>
    </View>
  );
}

interface AnalysisInsight {
  type: "loss" | "surplus" | "symmetry" | "unmatched" | "general";
  title: string;
  description: string;
  action: string;
  severity: "critical" | "warning" | "info";
}

function generateAnalysisInsights(
  result: InventoryImportResult,
  sectionSummary: Array<{ sec: string; loss: number; surplus: number; lossU: number; surplusU: number; count: number }>
): AnalysisInsight[] {
  const insights: AnalysisInsight[] = [];
  if (!result || result.variances.length === 0) return insights;

  const totalSystemValue = result.variances.reduce((acc, v) => acc + (v.systemQty * v.unitCost), 0);
  const absDiscrepancy = result.summary.totalLoss + result.summary.totalSurplus;
  const valueAccuracy = totalSystemValue > 0 ? Math.max(0, 1 - (absDiscrepancy / totalSystemValue)) * 100 : 100;
  
  const okSkus = result.variances.filter(v => v.status === "OK").length;
  const skuAccuracy = result.variances.length > 0 ? (okSkus / result.variances.length) * 100 : 100;

  if (valueAccuracy < 92) {
    insights.push({
      type: "general",
      title: "Baixa Acurácia Financeira",
      description: `A acurácia financeira geral está em ${valueAccuracy.toFixed(1)}%, abaixo do recomendado (95%). O valor absoluto das divergências (perdas + sobras) soma ${fmtBrl(absDiscrepancy)}.`,
      action: "Realizar inventários rotativos urgentes e auditar processos de movimentação de estoque.",
      severity: "critical"
    });
  } else {
    insights.push({
      type: "general",
      title: "Acurácia Geral Adequada",
      description: `A acurácia financeira consolidada está em ${valueAccuracy.toFixed(1)}%, com divergência líquida de ${fmtBrl(result.summary.netBalance)}.`,
      action: "Manter controle regular de estoque e cronograma padrão de auditorias cíclicas.",
      severity: "info"
    });
  }

  const topLossSection = sectionSummary[0];
  if (topLossSection && topLossSection.loss > 300) {
    insights.push({
      type: "loss",
      title: `Perda Crítica: Seção ${topLossSection.sec}`,
      description: `A seção "${topLossSection.sec}" lidera o ranking de perdas com ${fmtBrl(topLossSection.loss)} acumulados em ${topLossSection.lossU} unidades.`,
      action: `Aumentar o monitoramento visual e controle na área de exposição da seção ${topLossSection.sec}. Instituir contagens cíclicas frequentes.`,
      severity: "critical"
    });
  }

  const topSurplusSection = [...sectionSummary].sort((a, b) => b.surplus - a.surplus)[0];
  if (topSurplusSection && topSurplusSection.surplus > 300) {
    insights.push({
      type: "surplus",
      title: `Sobra Excessiva: Seção ${topSurplusSection.sec}`,
      description: `A seção "${topSurplusSection.sec}" apresenta sobra de ${fmtBrl(topSurplusSection.surplus)} em ${topSurplusSection.surplusU} unidades.`,
      action: `Auditar o recebimento e checagem física de notas para itens da seção ${topSurplusSection.sec}. Verificar possíveis inversões de EANs.`,
      severity: "warning"
    });
  }

  const totalLoss = result.summary.totalLoss;
  const totalSurplus = result.summary.totalSurplus;
  if (totalLoss > 500 && totalSurplus > 500) {
    const ratio = Math.min(totalLoss, totalSurplus) / Math.max(totalLoss, totalSurplus);
    if (ratio > 0.35) {
      insights.push({
        type: "symmetry",
        title: "Inversão / Troca de Códigos Detectada",
        description: `Simetria expressiva de perdas e sobras (Sincronia de ${(ratio * 100).toFixed(0)}%). Indica que itens similares estão sendo invertidos no momento da venda ou da contagem.`,
        action: "Instituir bipe unitário obrigatório nas frentes de caixa e orientar a equipe a bipar cada produto individualmente no inventário.",
        severity: "warning"
      });
    }
  }

  if (result.unmatched > 0) {
    insights.push({
      type: "unmatched",
      title: "Divergências de Itens sem Cadastro",
      description: `Foram contados ${result.unmatched} produtos cujo EAN não foi localizado no cadastro oficial do sistema.`,
      action: "Executar higienização do cadastro de produtos e associar corretamente os códigos EANs correspondentes.",
      severity: "warning"
    });
  }

  return insights;
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export default function InventoryDivergenceScreen() {
  const insets = useSafeAreaInsets();

  // ── Estado dos arquivos carregados ──
  const [files, setFiles] = useState<Record<string, string>>({});
  const [operators, setOperators] = useState<ParsedOperator[]>([]);
  const [result, setResult] = useState<InventoryImportResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("resultado_final");
  const [filter, setFilter] = useState<FilterStatus>("TODOS");
  const [search, setSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [sectionLimits, setSectionLimits] = useState<Record<string, number>>({});

  // ── Detectar adaptador disponível ──
  const detectedAdapter = useMemo(
    () => InventoryImportRegistry.detect(files),
    [files]
  );

  // ── Pick genérico de arquivo ──
  async function pickFile(key: string, label: string) {
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: ["text/*", "application/*", "*/*"],
        copyToCacheDirectory: true,
      });
      if (r.canceled) return;
      const asset = r.assets[0];
      const text = await readFileAsCsvText(asset.uri, asset.mimeType ?? undefined);
      setFiles((prev) => ({ ...prev, [key]: text }));

      // Auto-parse de conferentes
      if (key === "cadFun") {
        setOperators(parseCadFun(text));
      } else if (key === "agentes") {
        const parsed = parseAgentes(text);
        setOperators((prev) => {
          // Mescla: se CadFun já foi carregado, enriquece; senão usa agentes
          if (prev.length > 0) return prev;
          return parsed;
        });
      }
    } catch {
      Alert.alert("Erro", `Não foi possível ler o arquivo: ${label}`);
    }
  }

  // ── Processar ──
  async function handleProcess() {
    const adapter = detectedAdapter;
    if (!adapter) {
      Alert.alert(
        "Formato não reconhecido",
        "Carregue pelo menos o Arquivo Final de Contagem e o Saldo do Sistema para continuar."
      );
      return;
    }
    setProcessing(true);
    try {
      await new Promise<void>((res) => setTimeout(res, 30)); // yield para UI
      const r = crossReferenceInventory(adapter, files);
      setResult(r);
      setActiveTab("resultado_final");
    } catch (e: any) {
      Alert.alert("Erro ao processar", String(e?.message ?? e));
    } finally {
      setProcessing(false);
    }
  }

  // ── Exportar CSV ──
  async function handleExportCsv() {
    if (!result) return;
    const headers = [
      "EAN", "Codigo", "Descricao", "Familia", "Subclasse",
      "Fornecedor", "Secao", "Qtd_Sistema", "Qtd_Contada",
      "Diferenca", "Custo_Unit", "Valor_Diferenca", "Situacao",
    ];
    const rows = result.variances.map((v) => [
      v.ean, v.itemCode, v.description, v.family, v.subclass,
      v.supplier, v.section,
      v.systemQty.toFixed(4).replace(".", ","),
      v.countedQty,
      (v.difference >= 0 ? "+" : "") + v.difference,
      v.unitCost.toFixed(4).replace(".", ","),
      (v.valueVariance >= 0 ? "+" : "") + v.valueVariance.toFixed(2).replace(".", ","),
      v.status,
    ]);
    await shareCsvFile(
      `divergencias_${result.storeCode}_${result.inventoryDate}.csv`,
      headers,
      rows,
    );
  }

  // ── Listas filtradas ──
  const filteredVariances = useMemo(() => {
    if (!result) return [];
    let list = result.variances;
    if (filter !== "TODOS") list = list.filter((v) => v.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.description.toLowerCase().includes(q) ||
          v.ean.includes(q) ||
          v.family.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.valueVariance - b.valueVariance); // perdas primeiro
  }, [result, filter, search]);

  // ── Seções agrupadas ──
  const sectionSummary = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, { sec: string; loss: number; surplus: number; lossU: number; surplusU: number; count: number }>();
    for (const v of result.variances) {
      const sec = v.section || "S/SEC";
      const e = map.get(sec) ?? { sec, loss: 0, surplus: 0, lossU: 0, surplusU: 0, count: 0 };
      if (v.status === "PERDA") { e.loss += Math.abs(v.valueVariance); e.lossU += Math.abs(v.difference); }
      if (v.status === "SOBRA") { e.surplus += v.valueVariance; e.surplusU += v.difference; }
      e.count++;
      map.set(sec, e);
    }
    return [...map.values()].sort((a, b) => b.loss - a.loss);
  }, [result]);

  const insights = useMemo(() => {
    if (!result) return [];
    return generateAnalysisInsights(result, sectionSummary);
  }, [result, sectionSummary]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: "resultado_final", label: "Resultado Final", icon: "document-text-outline" },
    { key: "resumo",      label: "Resumo",    icon: "pie-chart-outline" },
    { key: "perdas",      label: "Perdas",    icon: "trending-down-outline" },
    { key: "sobras",      label: "Sobras",    icon: "trending-up-outline" },
    { key: "secoes",      label: "Seções",    icon: "grid-outline" },
    { key: "conferentes", label: "Equipe",    icon: "people-outline" },
  ];

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Importação de arquivos ─────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📂 Importar Arquivos do Sistema</Text>
          <Text style={styles.sectionSub}>
            Carregue os arquivos exportados do seu sistema de inventário. O formato é detectado automaticamente.
          </Text>

          {/* Bloco DPSP */}
          <View style={styles.adapterBlock}>
            <Text style={styles.adapterLabel}>📦 DPSP / ProInv</Text>
            <FileSlot label="Arquivo Final de Contagem" hint="L<loja>.txt — resultado oficial" required loaded={!!files["arqFinal"]} onPick={() => pickFile("arqFinal", "Arquivo Final")} />
            <FileSlot label="Catálogo de Produtos" hint="INVENT_DSP*.old — ponte EAN↔item" required loaded={!!files["inventDsp"]} onPick={() => pickFile("inventDsp", "INVENT_DSP")} />
            <FileSlot label="Saldo do Sistema" hint="SALDO_LOJA*.old — estoque esperado" required loaded={!!files["saldoLoja"]} onPick={() => pickFile("saldoLoja", "Saldo Loja")} />
            <FileSlot label="Mapa de Seções" hint="PROD-*.old — EAN por seção/gôndola" loaded={!!files["prodOld"]} onPick={() => pickFile("prodOld", "PROD.old")} />
          </View>

          {/* Bloco Conferentes */}
          <View style={styles.adapterBlock}>
            <Text style={styles.adapterLabel}>👥 Equipe de Conferentes</Text>
            <FileSlot label="Cadastro de Funcionários" hint="CadFun.txt — matrícula, cargo, CPF" loaded={!!files["cadFun"]} onPick={() => pickFile("cadFun", "CadFun")} />
            <FileSlot label="Agentes do Inventário" hint="agentes.txt — IDs do ProInv" loaded={!!files["agentes"]} onPick={() => pickFile("agentes", "agentes")} />
          </View>

          {/* Bloco CSV Genérico */}
          <View style={styles.adapterBlock}>
            <Text style={styles.adapterLabel}>📄 Outros Sistemas (CSV Genérico)</Text>
            <FileSlot label="Arquivo de Contagem" hint="Qualquer CSV com EAN + qtd contada" loaded={!!files["countCsv"]} onPick={() => pickFile("countCsv", "Contagem CSV")} />
            <FileSlot label="Saldo do Sistema" hint="CSV com EAN + qtd sistema + custo" loaded={!!files["stockCsv"]} onPick={() => pickFile("stockCsv", "Saldo CSV")} />
          </View>

          {/* Formato detectado */}
          {detectedAdapter && (
            <View style={styles.detectedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={styles.detectedText}>
                Formato detectado: <Text style={{ fontWeight: "700" }}>{detectedAdapter.name}</Text>
              </Text>
            </View>
          )}

          <Pressable
            style={[styles.btnProcess, (!detectedAdapter || processing) && styles.btnDisabled]}
            onPress={handleProcess}
            disabled={!detectedAdapter || processing}
          >
            <Ionicons name={processing ? "hourglass-outline" : "analytics"} size={20} color="#fff" />
            <Text style={styles.btnProcessText}>
              {processing ? "Processando..." : "Cruzar e Analisar Divergências"}
            </Text>
          </Pressable>
        </View>

        {/* ── Resultados ────────────────────────────────────────── */}
        {result && (
          <>
            {/* Cabeçalho do resultado */}
            <View style={styles.resultHeader}>
              <View>
                <Text style={styles.resultTitle}>
                  Loja {result.storeCode} · {result.inventoryDate}
                </Text>
                <Text style={styles.resultSub}>
                  {result.adapterUsed} · {fmtNum(result.totalMatched)}/{fmtNum(result.totalLinesCount)} itens cruzados
                </Text>
              </View>
              <Pressable style={styles.btnExport} onPress={handleExportCsv}>
                <Ionicons name="download-outline" size={16} color="#2563eb" />
                <Text style={styles.btnExportText}>CSV</Text>
              </Pressable>
            </View>

            {/* Abas */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ gap: 6 }}>
              {TABS.map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => setActiveTab(t.key)}
                  style={[styles.tab, activeTab === t.key && styles.tabActive]}
                >
                  <Ionicons name={t.icon as any} size={14} color={activeTab === t.key ? "#2563eb" : "#64748b"} />
                  <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* ── RESULTADO FINAL INVENTÁRIO ── */}
            {activeTab === "resultado_final" && (
              <View style={{ gap: 12 }}>
                {/* 1. Indicadores de Acurácia */}
                {(() => {
                  const totalSystemValue = result.variances.reduce((acc, v) => acc + (v.systemQty * v.unitCost), 0);
                  const totalCountedValue = result.variances.reduce((acc, v) => acc + (v.countedQty * v.unitCost), 0);
                  const absDiscrepancy = result.summary.totalLoss + result.summary.totalSurplus;
                  const valueAccuracy = totalSystemValue > 0 ? Math.max(0, 1 - (absDiscrepancy / totalSystemValue)) * 100 : 100;
                  
                  const okSkus = result.variances.filter(v => v.status === "OK").length;
                  const skuAccuracy = result.variances.length > 0 ? (okSkus / result.variances.length) * 100 : 100;

                  const accuracyColor = valueAccuracy >= 95 ? "#059669" : valueAccuracy >= 90 ? "#d97706" : "#ef4444";
                  const skuAccuracyColor = skuAccuracy >= 95 ? "#059669" : skuAccuracy >= 90 ? "#d97706" : "#ef4444";

                  return (
                    <View style={styles.accuracyContainer}>
                      <View style={styles.accuracyHeader}>
                        <Text style={styles.accuracyTitle}>📊 Acurácia Geral do Inventário</Text>
                        <Ionicons name="ribbon-outline" size={20} color={accuracyColor} />
                      </View>
                      
                      <View style={{ gap: 8 }}>
                        <View>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                            <Text style={{ fontSize: 12, fontWeight: "600", color: "#334155" }}>Acurácia Financeira (Valor)</Text>
                            <Text style={{ fontSize: 12, fontWeight: "700", color: accuracyColor }}>{valueAccuracy.toFixed(1)}%</Text>
                          </View>
                          <View style={styles.accuracyProgressBg}>
                            <View style={[styles.accuracyProgressFill, { width: `${valueAccuracy}%`, backgroundColor: accuracyColor }]} />
                          </View>
                        </View>

                        <View>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                            <Text style={{ fontSize: 12, fontWeight: "600", color: "#334155" }}>Acurácia de Itens (SKUs sem Divergência)</Text>
                            <Text style={{ fontSize: 12, fontWeight: "700", color: skuAccuracyColor }}>{skuAccuracy.toFixed(1)}%</Text>
                          </View>
                          <View style={styles.accuracyProgressBg}>
                            <View style={[styles.accuracyProgressFill, { width: `${skuAccuracy}%`, backgroundColor: skuAccuracyColor }]} />
                          </View>
                        </View>
                      </View>

                      <View style={styles.accuracyRow}>
                        <View style={styles.accuracyMiniCard}>
                          <Text style={styles.accuracyMiniLabel}>VALOR ESPERADO</Text>
                          <Text style={styles.accuracyMiniValue}>{fmtBrl(totalSystemValue)}</Text>
                        </View>
                        <View style={styles.accuracyMiniCard}>
                          <Text style={styles.accuracyMiniLabel}>VALOR CONTADO</Text>
                          <Text style={styles.accuracyMiniValue}>{fmtBrl(totalCountedValue)}</Text>
                        </View>
                        <View style={styles.accuracyMiniCard}>
                          <Text style={styles.accuracyMiniLabel}>SALDO LÍQUIDO</Text>
                          <Text style={[styles.accuracyMiniValue, { color: result.summary.netBalance < 0 ? "#ef4444" : "#059669" }]}>
                            {result.summary.netBalance > 0 ? "+" : ""}{fmtBrl(result.summary.netBalance)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                {/* 2. Pré-Análise das Causas e Melhorias */}
                {insights.length > 0 && (
                  <View style={styles.insightSection}>
                    <Text style={styles.insightTitle}>🔍 Pré-Análise & Diagnóstico de Divergências</Text>
                    {insights.map((ins, idx) => {
                      const borderColor = ins.severity === "critical" ? "#ef4444" : ins.severity === "warning" ? "#d97706" : "#2563eb";
                      const headerColor = ins.severity === "critical" ? "#b91c1c" : ins.severity === "warning" ? "#b45309" : "#1d4ed8";
                      const iconName = ins.severity === "critical" ? "alert-circle" : ins.severity === "warning" ? "warning" : "information-circle";
                      return (
                        <View key={idx} style={[styles.insightCard, { borderLeftColor: borderColor }]}>
                          <View style={styles.insightCardHeader}>
                            <Ionicons name={iconName as any} size={16} color={borderColor} />
                            <Text style={[styles.insightCardTitle, { color: headerColor }]}>{ins.title}</Text>
                          </View>
                          <Text style={styles.insightDesc}>{ins.description}</Text>
                          <View style={styles.insightActionBlock}>
                            <Text style={styles.insightActionLabel}>Melhoria Recomendada</Text>
                            <Text style={styles.insightActionText}>{ins.action}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* 3. Acordeão de Seções e Produtos */}
                <View style={styles.accordionContainer}>
                  <Text style={styles.accordionTitle}>📂 Divergências por Seção e Produtos</Text>
                  {sectionSummary.map((s) => {
                    const isExpanded = !!expandedSections[s.sec];
                    return (
                      <View key={s.sec} style={{ borderRadius: 10, overflow: "hidden" }}>
                        <Pressable
                          style={[styles.accordionHeader, isExpanded && styles.accordionHeaderExpanded]}
                          onPress={() =>
                            setExpandedSections((prev) => ({
                              ...prev,
                              [s.sec]: !prev[s.sec],
                            }))
                          }
                        >
                          <Text style={styles.accordionHeaderText} numberOfLines={1}>
                            {s.sec}
                          </Text>
                          <Text style={styles.accordionHeaderSummary}>
                            {s.loss > 0 && <Text style={{ color: "#ef4444" }}>Perda: {fmtBrl(s.loss)} ({fmtNum(s.lossU)} un)   </Text>}
                            {s.surplus > 0 && <Text style={{ color: "#059669" }}>Sobra: {fmtBrl(s.surplus)} ({fmtNum(s.surplusU)} un)</Text>}
                          </Text>
                          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
                        </Pressable>

                        {isExpanded && (
                          <View style={styles.accordionContent}>
                            <View style={styles.accordionTableHeader}>
                              <Text style={[styles.accordionTh, { flex: 2.2 }]}>Produto</Text>
                              <Text style={[styles.accordionTh, { flex: 0.8, textAlign: "center" }]}>Sist.</Text>
                              <Text style={[styles.accordionTh, { flex: 0.8, textAlign: "center" }]}>Cont.</Text>
                              <Text style={[styles.accordionTh, { flex: 0.8, textAlign: "right" }]}>Dif.</Text>
                              <Text style={[styles.accordionTh, { flex: 1.2, textAlign: "right" }]}>Valor</Text>
                            </View>
                            {(() => {
                              const secVariances = result.variances
                                .filter((v) => (v.section || "S/SEC") === s.sec && v.difference !== 0)
                                .sort((a, b) => Math.abs(b.valueVariance) - Math.abs(a.valueVariance));

                              if (secVariances.length === 0) {
                                return <Text style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", paddingVertical: 8 }}>Sem divergências nesta seção.</Text>;
                              }

                              const limit = sectionLimits[s.sec] ?? 10;
                              const displayed = secVariances.slice(0, limit);
                              const hasMore = secVariances.length > limit;

                              return (
                                <>
                                  {displayed.map((v, idx) => {
                                    const isLoss = v.status === "PERDA";
                                    const color = isLoss ? "#ef4444" : "#059669";
                                    return (
                                      <View key={idx} style={styles.accordionRow}>
                                        <View style={{ flex: 2.2 }}>
                                          <Text style={styles.accordionCellDesc} numberOfLines={1}>
                                            {v.description}
                                          </Text>
                                          <Text style={styles.accordionCellMeta}>
                                            EAN {v.ean} · Cód {v.itemCode}
                                          </Text>
                                        </View>
                                        <Text style={[styles.accordionCellQty, { flex: 0.8 }]}>{fmtNum(v.systemQty)}</Text>
                                        <Text style={[styles.accordionCellQty, { flex: 0.8 }]}>{fmtNum(v.countedQty)}</Text>
                                        <Text style={[styles.accordionCellDiff, { flex: 0.8, color }]}>
                                          {v.difference > 0 ? "+" : ""}{fmtNum(v.difference)}
                                        </Text>
                                        <Text style={[styles.accordionCellVal, { flex: 1.2, color }]}>
                                          {v.valueVariance > 0 ? "+" : ""}{fmtBrl(v.valueVariance)}
                                        </Text>
                                      </View>
                                    );
                                  })}
                                  {hasMore && (
                                    <Pressable
                                      style={styles.accordionShowMore}
                                      onPress={() =>
                                        setSectionLimits((prev) => ({
                                          ...prev,
                                          [s.sec]: limit + 15,
                                        }))
                                      }
                                    >
                                      <Ionicons name="chevron-down-outline" size={14} color="#2563eb" />
                                      <Text style={styles.accordionShowMoreText}>
                                        Mostrar mais {secVariances.length - limit} itens
                                      </Text>
                                    </Pressable>
                                  )}
                                </>
                              );
                            })()}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── RESUMO ── */}
            {activeTab === "resumo" && (
              <View style={styles.section}>
                <View style={styles.metricsGrid}>
                  <MetricCard label="PERDA" value={fmtBrl(result.summary.totalLoss)} sub={`${fmtNum(result.summary.lossUnits)} un · ${result.summary.lossCount} SKUs`} color="#ef4444" icon="trending-down-outline" />
                  <MetricCard label="SOBRA" value={fmtBrl(result.summary.totalSurplus)} sub={`${fmtNum(result.summary.surplusUnits)} un · ${result.summary.surplusCount} SKUs`} color="#059669" icon="trending-up-outline" />
                </View>
                <MetricCard
                  label="SALDO LÍQUIDO"
                  value={fmtBrl(result.summary.netBalance)}
                  sub={result.summary.netBalance < 0 ? "Resultado desfavorável" : "Resultado favorável"}
                  color={result.summary.netBalance < 0 ? "#ef4444" : "#059669"}
                  icon="wallet-outline"
                />
                <View style={styles.infoRow}>
                  <Ionicons name="information-circle-outline" size={14} color="#64748b" />
                  <Text style={styles.infoText}>
                    {fmtNum(result.totalMatched)} itens cruzados · {fmtNum(result.unmatched)} sem correspondência no saldo
                  </Text>
                </View>
              </View>
            )}

            {/* ── PERDAS / SOBRAS ── */}
            {(activeTab === "perdas" || activeTab === "sobras") && (
              <View style={styles.section}>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar produto, família, EAN..."
                  placeholderTextColor="#94a3b8"
                  style={styles.searchInput}
                />
                {(() => {
                  const list = (result.variances)
                    .filter((v) => v.status === (activeTab === "perdas" ? "PERDA" : "SOBRA"))
                    .filter((v) => !search.trim() || v.description.toLowerCase().includes(search.toLowerCase()) || v.ean.includes(search) || v.family.toLowerCase().includes(search.toLowerCase()))
                    .sort((a, b) => activeTab === "perdas" ? a.valueVariance - b.valueVariance : b.valueVariance - a.valueVariance);
                  if (list.length === 0) return <Text style={styles.empty}>Nenhum item encontrado.</Text>;
                  return list.map((v, i) => <VarianceRow key={i} v={v} />);
                })()}
              </View>
            )}

            {/* ── SEÇÕES ── */}
            {activeTab === "secoes" && (
              <View style={styles.section}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { flex: 0.6 }]}>Seção</Text>
                  <Text style={[styles.th, { flex: 1 }]}>Perda (R$)</Text>
                  <Text style={[styles.th, { flex: 1 }]}>Sobra (R$)</Text>
                  <Text style={[styles.th, { flex: 0.5 }]}>SKUs</Text>
                </View>
                {sectionSummary.slice(0, 40).map((s) => (
                  <View key={s.sec} style={styles.secRow}>
                    <Text style={[styles.secCell, { flex: 0.6, fontWeight: "700", color: "#1e293b" }]}>{s.sec}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.secCell, { color: "#ef4444" }]}>{fmtBrl(s.loss)}</Text>
                      <Text style={styles.secCellSub}>{fmtNum(s.lossU)} un</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.secCell, { color: "#059669" }]}>{fmtBrl(s.surplus)}</Text>
                      <Text style={styles.secCellSub}>{fmtNum(s.surplusU)} un</Text>
                    </View>
                    <Text style={[styles.secCell, { flex: 0.5, color: "#64748b" }]}>{s.count}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ── CONFERENTES ── */}
            {activeTab === "conferentes" && (
              <View style={styles.section}>
                {operators.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="people-outline" size={40} color="#cbd5e1" />
                    <Text style={styles.emptyTitle}>Nenhum conferente carregado</Text>
                    <Text style={styles.emptyHint}>
                      Importe o arquivo CadFun.txt (ou agentes.txt) para visualizar a equipe.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.opCount}>{fmtNum(operators.length)} colaboradores cadastrados</Text>
                    {operators.map((op, i) => (
                      <View key={i} style={styles.opRow}>
                        <View style={styles.opAvatar}>
                          <Text style={styles.opAvatarText}>{op.name.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.opName}>{op.name}</Text>
                          <Text style={styles.opMeta}>
                            {op.role ? `${op.role}` : "Conferente"}
                            {op.id ? `  ·  Mat. ${op.id}` : ""}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },

  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  sectionSub:   { fontSize: 12, color: "#64748b", lineHeight: 18 },

  adapterBlock: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 8,
    backgroundColor: "#f8fafc",
  },
  adapterLabel: { fontSize: 12, fontWeight: "700", color: "#475569", marginBottom: 2 },

  fileSlot: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
  },
  fileSlotLoaded: { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4" },
  fileSlotLabel:  { fontSize: 13, fontWeight: "600", color: "#334155" },
  fileSlotHint:   { fontSize: 11, color: "#94a3b8", marginTop: 2 },

  detectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  detectedText: { fontSize: 12, color: "#166534" },

  btnProcess: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
  },
  btnDisabled:     { backgroundColor: "#94a3b8" },
  btnProcessText:  { color: "#fff", fontWeight: "700", fontSize: 15 },

  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  resultTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  resultSub:   { fontSize: 11, color: "#64748b", marginTop: 2 },
  btnExport: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1.5,
    borderColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnExportText: { fontSize: 12, fontWeight: "700", color: "#2563eb" },

  tabBar: { flexGrow: 0 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tabActive:     { backgroundColor: "#dbeafe", borderColor: "#2563eb" },
  tabText:       { fontSize: 12, fontWeight: "600", color: "#64748b" },
  tabTextActive: { color: "#2563eb" },

  metricsGrid: { flexDirection: "row", gap: 10 },
  metricCard: {
    flex: 1,
    borderLeftWidth: 4,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 4,
  },
  metricTop:  { flexDirection: "row", alignItems: "center", gap: 6 },
  metricLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  metricValue: { fontSize: 16, fontWeight: "800" },
  metricSub:   { fontSize: 10, color: "#64748b" },

  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  infoText: { fontSize: 11, color: "#64748b", flex: 1 },

  searchInput: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0f172a",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  varRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  varDesc:  { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  varMeta:  { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  varRight: { alignItems: "flex-end" },
  varDiff:  { fontSize: 13, fontWeight: "700" },
  varValue: { fontSize: 11, fontWeight: "600", marginTop: 2 },

  empty: { textAlign: "center", color: "#94a3b8", paddingVertical: 20 },

  tableHeader: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 2,
    borderBottomColor: "#e2e8f0",
  },
  th: { fontSize: 11, fontWeight: "700", color: "#64748b" },

  secRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  secCell:    { fontSize: 12, fontWeight: "600" },
  secCellSub: { fontSize: 10, color: "#94a3b8" },

  emptyBox: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: "#94a3b8" },
  emptyHint:  { fontSize: 12, color: "#cbd5e1", textAlign: "center" },

  opCount: { fontSize: 12, color: "#64748b", marginBottom: 4 },
  opRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  opAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#dbeafe",
    alignItems: "center", justifyContent: "center",
  },
  opAvatarText: { fontSize: 15, fontWeight: "700", color: "#2563eb" },
  opName:       { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  opMeta:       { fontSize: 11, color: "#94a3b8", marginTop: 2 },

  // Styles for Resultado Final
  accuracyContainer: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 4,
  },
  accuracyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accuracyTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  accuracyProgressBg: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 4,
  },
  accuracyProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
  accuracyRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  accuracyMiniCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  accuracyMiniLabel: { fontSize: 8, color: "#64748b", fontWeight: "700" },
  accuracyMiniValue: { fontSize: 12, fontWeight: "700", color: "#1e293b", marginTop: 4 },

  insightSection: { gap: 10, marginTop: 4 },
  insightTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  insightCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 14,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  insightCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  insightCardTitle: { fontSize: 13, fontWeight: "700" },
  insightDesc: { fontSize: 12, color: "#334155", lineHeight: 17 },
  insightActionBlock: {
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    marginTop: 4,
  },
  insightActionLabel: { fontSize: 8, fontWeight: "800", color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 },
  insightActionText: { fontSize: 11, color: "#475569", marginTop: 2, lineHeight: 15 },

  accordionContainer: { gap: 10, marginTop: 4 },
  accordionTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  accordionHeaderExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  accordionHeaderText: { fontSize: 12, fontWeight: "700", color: "#1e293b", flex: 1 },
  accordionHeaderSummary: { fontSize: 10, color: "#64748b", marginRight: 8, textAlign: "right" },
  accordionContent: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  accordionTableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 6,
    marginBottom: 4,
  },
  accordionTh: { fontSize: 9, fontWeight: "700", color: "#64748b" },
  accordionRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "center",
  },
  accordionCellDesc: { fontSize: 11, fontWeight: "600", color: "#1e293b" },
  accordionCellMeta: { fontSize: 9, color: "#94a3b8", marginTop: 1 },
  accordionCellQty: { fontSize: 11, color: "#334155", textAlign: "center" },
  accordionCellDiff: { fontSize: 11, fontWeight: "700", textAlign: "right" },
  accordionCellVal: { fontSize: 11, fontWeight: "600", textAlign: "right" },
  accordionShowMore: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    gap: 4,
  },
  accordionShowMoreText: { fontSize: 11, fontWeight: "700", color: "#2563eb" },
});
