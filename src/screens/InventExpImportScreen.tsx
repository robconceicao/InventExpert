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
import {
    getLimitesBlocoFallback,
    INVENTORY_PROFILES,
    type LimiteBlocoRow,
} from "../config/inventoryEvalConfig";
import { getLimitesBlocoArea } from "../repositories/limitesBlocoRepository";
import { getSecaoLookup } from "../repositories/secaoLookupRepository";
import {
    evaluateChecker,
    sortRanking,
} from "../services/InventoryEvaluationService";
import type {
    ContagemDetalhada,
    InventoryCheckerEvaluation,
    InventoryOperationType,
    SectionAccuracyRecord,
} from "../types";
import {
    buildCatalogoIndex,
    buildInventDspIndex,
    resolverProduto,
} from "../utils/catalogoLookup";
import { shareCsvFile, sharePdfFromHtml, shareTextFile } from "../utils/export";
import { generateInventExpIndividualReportHtml } from "../utils/inventExpReportHtml";
import { readFileAsCsvText, readFileAsText } from "../utils/fileImport";
import {
    generateInventExpGerencialReportText,
    generateInventExpIndividualReportText,
} from "../utils/inventExpReports";
import {
    enriquecerSecoesComBloco,
    extractProductivityTotals,
    filtrarContagensDoConferente,
    filtrarSecoesDoConferente,
    parseProducaoSecaoCsv,
    resolverAreasNasContagens,
} from "../utils/inventoryImportParsers";
import { parseInventoryCheckersCsv } from "../utils/parsers";
import { parsePrcFile } from "../utils/prcParser";


const EXAMPLE_INVENTEXP_CSV = `NOME DO CONFERENTE;PRODUTIVIDADE;QTDE. VOLUMES;1a1;BLOCO;HORAS ESTIMADAS;ERRO;% ERRO
AMANDA DE OLIVEIRA P...;395,33;752;0;18;1,9;13;1,73%
ANA CLAUDIA SILVA;802,26;5549;4487;374;6,9;13;0,23%
CAMILA FERREIRA;1046,31;5573;1190;451;5,3;0;0,00%`;

export default function InventExpImportScreen() {
  const [operationType, setOperationType] =
    useState<InventoryOperationType>("FARMACIA");
  const [rawText, setRawText] = useState("");
  const [evaluations, setEvaluations] = useState<InventoryCheckerEvaluation[]>(
    [],
  );
  const [prcInfo, setPrcInfo] = useState<{ count: number; totalLines: number } | null>(null);
  const [prcContagens, setPrcContagens] = useState<ContagemDetalhada[]>([]);

  const [cadastroText, setCadastroText] = useState("");
  const [inventDspText, setInventDspText] = useState("");
  const [producaoSecao, setProducaoSecao] = useState<SectionAccuracyRecord[]>([]);
  /** Nome do líder (Acompanhamento) — excluído da avaliação automática */
  const [leaderName, setLeaderName] = useState("");
  const [processing, setProcessing] = useState(false);

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

  const handlePickPrcFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;

      const arquivos = result.assets;
      const allContagens: ContagemDetalhada[] = [];

      for (const arquivo of arquivos) {
        const conteudo = await readFileAsText(arquivo.uri);
        allContagens.push(...parsePrcFile(conteudo));
      }

      setPrcContagens(allContagens);
      setPrcInfo({ count: arquivos.length, totalLines: allContagens.length });
      Alert.alert(
        "Arquivos .prc",
        `✓ ${arquivos.length} arquivo(s) · ${allContagens.length.toLocaleString("pt-BR")} linhas válidas`,
      );
    } catch {
      Alert.alert("Erro", "Não foi possível ler os arquivos .prc.");
    }
  };

  const handlePickCadastro = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "text/plain", copyToCacheDirectory: true });
      if (result.canceled) return;
      setCadastroText(await readFileAsText(result.assets[0].uri));
      Alert.alert("Sucesso", "cadastro.txt carregado.");
    } catch {
      Alert.alert("Erro", "Falha ao ler cadastro.txt.");
    }
  };

  const handlePickInventDsp = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled) return;
      setInventDspText(await readFileAsText(result.assets[0].uri));
      Alert.alert("Sucesso", "invent_DSP carregado.");
    } catch {
      Alert.alert("Erro", "Falha ao ler invent_DSP.");
    }
  };

  const handlePickProducaoSecao = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      const text = await readFileAsCsvText(file.uri, file.mimeType ?? undefined);
      setProducaoSecao(parseProducaoSecaoCsv(text));
      Alert.alert("Sucesso", "PRODUÇÃO_SEÇÃO carregado.");
    } catch {
      Alert.alert("Erro", "Falha ao ler PRODUÇÃO_SEÇÃO.");
    }
  };

  const handleProcess = async () => {
    const parsed = parseInventoryCheckersCsv(rawText);
    if (parsed.length === 0) {
      Alert.alert(
        "Dados inválidos",
        "Cole a tabela ou anexe CSV/Excel.\nColunas obrigatórias: Nome, Qtde, Qtde1a1, Produtividade, Erro.",
      );
      return;
    }

    setProcessing(true);
    try {
      const { totalPecas, duracaoHoras } = extractProductivityTotals(rawText);
      const catalogoIdx = buildCatalogoIndex(cadastroText);
      const inventDspIdx = buildInventDspIndex(inventDspText);

      // --- lookups UMA vez (sem N+1) ---
      const secaoRows = await getSecaoLookup(operationType);
      const secaoMap = new Map<string, string>();
      for (const s of secaoRows) {
        secaoMap.set(s.codigo_secao, s.nome_area);
        const stripped = s.codigo_secao.replace(/^0+/, "");
        if (stripped) secaoMap.set(stripped, s.nome_area);
      }

      let limites: LimiteBlocoRow[] = await getLimitesBlocoArea(operationType);
      if (!limites.length) {
        limites = getLimitesBlocoFallback(operationType);
      }

      // Resolve produto + área em todas as contagens .prc acumuladas
      let contagensAtualizadas = resolverAreasNasContagens(
        prcContagens,
        secaoMap,
      );
      contagensAtualizadas = contagensAtualizadas.map((c) => {
        const prod = resolverProduto(
          c.produto_codigo,
          inventDspIdx,
          catalogoIdx,
        );
        return {
          ...c,
          produto_nome: prod.nome,
          produto_ean: prod.ean,
          produto_classe: prod.classe,
        };
      });
      setPrcContagens(contagensAtualizadas);

      const leader = leaderName.trim() || undefined;
      const numConferentes = parsed.length;

      const evaluated: InventoryCheckerEvaluation[] = [];
      for (const item of parsed) {
        const contagens = filtrarContagensDoConferente(
          contagensAtualizadas,
          item.matricula,
          item.nome,
        );
        let secoesDoConferente = filtrarSecoesDoConferente(
          producaoSecao,
          item.matricula,
          item.nome,
        );
        secoesDoConferente = enriquecerSecoesComBloco(
          secoesDoConferente,
          contagens,
          limites,
        );

        const input = {
          ...item,
          contagensDetalhadas: contagens,
          sectionAccuracy: secoesDoConferente,
        };

        const ev = evaluateChecker(
          input,
          operationType,
          totalPecas,
          duracaoHoras || 5,
          numConferentes,
          undefined,
          secoesDoConferente,
          limites,
          leader,
        );
        if (ev) evaluated.push(ev);
      }

      setEvaluations(sortRanking(evaluated));
      if (evaluated.length === 0) {
        Alert.alert(
          "Sem avaliações",
          "Nenhum conferente restante após exclusão de líderes / filtros.",
        );
      }
    } catch (e) {
      console.warn("[InventExp] Erro ao processar avaliação:", e);
      Alert.alert("Erro", "Falha ao processar a avaliação. Verifique os arquivos.");
    } finally {
      setProcessing(false);
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
      undefined,
      ev.secoes,
      ev.violacoes,
    );
    const waUrl =
      Platform.OS === "web"
        ? `https://wa.me/?text=${encodeURIComponent(text)}`
        : `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(waUrl).catch(() =>
      Alert.alert(
        "Erro",
        "Não foi possível abrir o WhatsApp neste dispositivo.",
      ),
    );
  };

  const handleExportIndividualPdf = async (
    ev: InventoryCheckerEvaluation,
    index: number,
  ) => {
    const html = generateInventExpIndividualReportHtml(
      operationType,
      ev,
      index + 1,
      evaluations.length,
      undefined,
      ev.secoes,
      ev.violacoes,
    );
    const safeName = (ev.input.nome || "conferente")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 40);
    await sharePdfFromHtml(
      `avaliacao_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`,
      html,
      "Exportar PDF Avaliação Individual",
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
              "HIPERMERCADO",
              "ATACADO",
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
          <Text style={styles.cardTitle}>Arquivos Auxiliares (Opcional)</Text>
          <View style={styles.importRow}>
            <Pressable style={styles.btnAttach} onPress={handlePickPrcFiles}>
              <Ionicons name="documents-outline" size={20} color="#2563EB" />
              <Text style={styles.btnAttachText}>Carregar .prc</Text>
            </Pressable>
            <Pressable style={styles.btnAttach} onPress={handlePickCadastro}>
              <Ionicons name="document-text-outline" size={20} color="#2563EB" />
              <Text style={styles.btnAttachText}>cadastro.txt</Text>
            </Pressable>
            <Pressable style={styles.btnAttach} onPress={handlePickInventDsp}>
              <Ionicons name="server-outline" size={20} color="#2563EB" />
              <Text style={styles.btnAttachText}>invent_DSP</Text>
            </Pressable>
            <Pressable style={styles.btnAttach} onPress={handlePickProducaoSecao}>
              <Ionicons name="grid-outline" size={20} color="#2563EB" />
              <Text style={styles.btnAttachText}>PROD_SEÇÃO</Text>
            </Pressable>
          </View>
          {prcInfo && (
            <Text style={styles.prcPreview}>
              ✓ {prcInfo.count} arquivo(s) .prc ·{" "}
              {prcInfo.totalLines.toLocaleString("pt-BR")} linhas
            </Text>
          )}
          {cadastroText ? (
            <Text style={styles.prcPreview}>✓ cadastro.txt carregado</Text>
          ) : null}
          {inventDspText ? (
            <Text style={styles.prcPreview}>✓ invent_DSP.old carregado</Text>
          ) : null}
          {producaoSecao.length > 0 ? (
            <Text style={styles.prcPreview}>
              ✓ PRODUÇÃO_SEÇÃO carregado ({producaoSecao.length} linhas)
            </Text>
          ) : null}

          <Text style={styles.subtitle}>
            Líder da operação (excluído da avaliação automática)
          </Text>
          <TextInput
            value={leaderName}
            onChangeText={setLeaderName}
            placeholder="Nome do líder (opcional)"
            placeholderTextColor="#94A3B8"
            style={styles.leaderInput}
            autoCapitalize="characters"
          />
        </View>

        <Pressable
          style={[
            styles.btnPrimary,
            (rawText.length === 0 || processing) && { opacity: 0.5 },
          ]}
          onPress={() => void handleProcess()}
          disabled={rawText.length === 0 || processing}
        >
          <Text style={styles.btnTextWhite}>
            {processing ? "Processando…" : "Processar Avaliação"}
          </Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Importar dados dos conferentes</Text>
          <Text style={styles.subtitle}>
            Cole a tabela (vírgula, ponto e vírgula ou tab) ou anexe arquivo
            CSV/Excel. Colunas: Nome, Qtde, Qtde1a1, Produtividade (itens/h),
            Erro (qtde).
          </Text>
          <View style={styles.importRow}>
            <Pressable onPress={() => void handlePickFile()} style={styles.btnAttach}>
              <Ionicons name="attach" size={20} color="#2563EB" />
              <Text style={styles.btnAttachText}>Anexar CSV/Excel</Text>
            </Pressable>
            <Pressable onPress={() => void handlePickPrcFiles()} style={[styles.btnAttach, styles.btnAttachGreen]}>
              <Ionicons name="document-outline" size={20} color="#059669" />
              <Text style={[styles.btnAttachText, styles.btnAttachTextGreen]}>.prc (Bloco)</Text>
            </Pressable>
          </View>
          {prcInfo && (
            <Text style={styles.prcPreview}>
              ✓{" "}
              {prcInfo.count === 1
                ? "1 arquivo"
                : `${prcInfo.count} arquivos`}{" "}
              · {prcInfo.totalLines.toLocaleString("pt-BR")} linhas
            </Text>
          )}
          <TextInput
            value={rawText}
            onChangeText={setRawText}
            placeholder={EXAMPLE_INVENTEXP_CSV}
            placeholderTextColor="#94A3B8"
            multiline
            style={styles.textArea}
            textAlignVertical="top"
          />
          <Pressable
            onPress={() => void handleProcess()}
            style={[styles.btnPrimary, processing && { opacity: 0.5 }]}
            disabled={processing}
          >
            <Ionicons name="calculator-outline" size={20} color="#fff" />
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
                  secoes={evaluations[0].secoes}
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
              {evaluations[0] && (
                <Pressable
                  onPress={() => void handleExportIndividualPdf(evaluations[0], 0)}
                  style={[styles.btnExport, { backgroundColor: "#b91c1c" }]}
                >
                  <Ionicons name="print-outline" size={20} color="#fff" />
                  <Text style={styles.btnTextWhite}>PDF 1º ranking</Text>
                </Pressable>
              )}
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
    flexWrap: "wrap",
    gap: 8,
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
  btnAttachGreen: {
    borderColor: "#059669",
    backgroundColor: "#f0fdf4",
  },
  btnAttachTextGreen: {
    color: "#059669",
  },
  prcPreview: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    marginBottom: 4,
  },
  leaderInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "#F8FAFC",
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
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
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
