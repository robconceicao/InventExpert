import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { INVENTORY_PROFILES } from "../config/inventoryEvalConfig";
import {
  getSectionAreaNome,
  getSectionBlocoPct,
  getViolacaoArea,
  getViolacaoCritica,
  getViolacaoLimitePct,
  getViolacaoRealPct,
  type InventoryCheckerEvaluation,
  type InventoryOperationType,
  type SectionAccuracyRecord,
  type ViolacaoBloco,
} from "../types";

interface CheckerFeedbackReportProps {
  evaluation: InventoryCheckerEvaluation;
  operationType: InventoryOperationType;
  secoes?: SectionAccuracyRecord[];
}

function isAlertaFormal(v: ViolacaoBloco): boolean {
  return getViolacaoCritica(v) || getViolacaoLimitePct(v) <= 5;
}

function statusIcon(sec: SectionAccuracyRecord): string {
  if (sec.violacaoBloco) {
    return getViolacaoCritica(sec.violacaoBloco) ? "🚨" : "⚠️";
  }
  if (sec.violacao_bloco) {
    return sec.area_critica ? "🚨" : "⚠️";
  }
  return "✅";
}

export function CheckerFeedbackReport({
  evaluation,
  operationType,
  secoes: secoesProp,
}: CheckerFeedbackReportProps) {
  const profile = INVENTORY_PROFILES[operationType];
  const { targets, alerts } = profile;

  const { input, pctErro, pctBloco, nivelColor, nivel, tags, scoreFinal } =
    evaluation;

  const pct1a1 = 100 - pctBloco;
  const violacoes = evaluation.violacoes || evaluation.violacoesBloco || [];
  const alertas = violacoes.filter(isAlertaFormal);
  const secoes =
    secoesProp ||
    evaluation.secoes ||
    evaluation.input.sectionAccuracy ||
    [];

  const mensagens: string[] = [];

  if (pctErro > targets.erroCritico) {
    mensagens.push(
      "Parte da sua produtividade foi reduzida porque a taxa de erro ficou acima do limite crítico.",
    );
  }
  if (pctBloco > targets.maxBlockLimit) {
    mensagens.push(
      "Você perdeu pontos de aderência pelo uso acima do recomendado de contagem em bloco.",
    );
  }
  if (
    pctErro <= targets.erroTolerancia &&
    input.produtividade > targets.productivity
  ) {
    mensagens.push(
      "Você recebeu bônus por manter boa qualidade mesmo com produtividade acima da meta.",
    );
  }
  if (pctErro > 1.5 && pctBloco > alerts.criticalBlockLimit) {
    mensagens.push(
      "Foi identificado risco de contagem superficial (erro alto com muito bloco).",
    );
  }
  if (violacoes.length > 0) {
    mensagens.push(
      `Penalidade de bloco aplicada em ${violacoes.length} área(s).`,
    );
  }
  if (mensagens.length === 0) {
    mensagens.push(
      "A sua nota foi calculada equilibrando qualidade, produtividade e aderência ao método.",
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { borderColor: nivelColor }]}>
        <View style={styles.headerInfo}>
          <Text style={styles.nome}>{input.nome}</Text>
          <Text style={[styles.nivel, { color: nivelColor }]}>{nivel}</Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: nivelColor }]}>
          <Text style={styles.scoreText}>{scoreFinal}</Text>
        </View>
      </View>

      {/* Alerta formal de área restrita — sem "Perfil Operacional" */}
      {alertas.length > 0 && (
        <View style={styles.alertaBox}>
          <Text style={styles.alertaTitle}>
            🚨 ALERTA — USO DE BLOCO EM ÁREA RESTRITA
          </Text>
          {alertas.map((v, i) => (
            <Text key={i} style={styles.alertaText}>
              {getViolacaoArea(v)}: {getViolacaoRealPct(v).toFixed(1)}% (limite{" "}
              {getViolacaoLimitePct(v)}%)
            </Text>
          ))}
        </View>
      )}

      {(tags.length > 0 || violacoes.length > 0) && (
        <View style={styles.tagsContainer}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {violacoes.length > 0 && (
            <View style={[styles.tagChip, { backgroundColor: "#fee2e2" }]}>
              <Text style={[styles.tagText, { color: "#dc2626" }]}>
                ⚠️ Violou limites em {violacoes.length} área(s)
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Os seus números</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Total de peças</Text>
            <Text style={styles.metricValue}>{input.qtde}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Ritmo (itens/h)</Text>
            <Text style={styles.metricValue}>{input.produtividade}</Text>
          </View>
        </View>
        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>% Erro</Text>
            <Text style={styles.metricValue}>{pctErro.toFixed(2)}%</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>1 a 1 vs Bloco</Text>
            <Text style={styles.metricValue}>
              {pct1a1.toFixed(1)}% 1a1 / {pctBloco.toFixed(1)}% Bloco
            </Text>
          </View>
        </View>
      </View>

      {secoes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUAS SEÇÕES — ACURÁCIA</Text>
          {secoes.map((sec, i) => {
            const area = getSectionAreaNome(sec);
            const bloco = getSectionBlocoPct(sec);
            return (
              <View key={`${area}-${i}`} style={styles.secaoRow}>
                <Text style={styles.secaoStatus}>{statusIcon(sec)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.secaoNome}>{area}</Text>
                  <Text style={styles.secaoMeta}>
                    Bloco {bloco.toFixed(1)}%
                    {sec.limite_bloco != null
                      ? ` · lim. ${sec.limite_bloco}%`
                      : ""}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {violacoes.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: "#dc2626" }]}>
            ⚠️ Penalidades de Bloco
          </Text>
          {violacoes.map((v, i) => {
            const vArea = getViolacaoArea(v);
            const vLimit = getViolacaoLimitePct(v);
            const vReal = getViolacaoRealPct(v);
            const vCritica = getViolacaoCritica(v);
            let status = "";
            if (vLimit === 0 && vCritica) {
              status = `PROIBIDO BLOCO | Realizado ${vReal.toFixed(1)}%`;
            } else {
              status = `Limite ${vLimit.toFixed(1)}% | Realizado ${vReal.toFixed(
                1,
              )}%${vCritica ? " (CRÍTICA)" : ""}`;
            }
            return (
              <Text key={i} style={styles.explanationText}>
                • {vArea} - {status}
              </Text>
            );
          })}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Como a sua nota foi calculada</Text>
        <Text style={styles.scoreLine}>
          Q {Math.round(evaluation.scoreQualidade)} · P{" "}
          {Math.round(evaluation.scoreProdutividade)} · A{" "}
          {Math.round(evaluation.scoreAderencia)}
        </Text>
        {mensagens.map((m) => (
          <Text key={m} style={styles.explanationText}>
            • {m}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  nome: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
  },
  nivel: {
    fontSize: 14,
    fontWeight: "500",
  },
  scoreBadge: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scoreText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
  },
  alertaBox: {
    backgroundColor: "#fef2f2",
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626",
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  alertaTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#991b1b",
  },
  alertaText: {
    fontSize: 12,
    color: "#7f1d1d",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#e0f2fe",
  },
  tagText: {
    fontSize: 12,
    color: "#0f172a",
  },
  section: {
    marginTop: 4,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
  },
  metricLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  secaoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  secaoStatus: {
    fontSize: 16,
    width: 24,
  },
  secaoNome: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  secaoMeta: {
    fontSize: 11,
    color: "#64748b",
  },
  scoreLine: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  explanationText: {
    fontSize: 13,
    color: "#334155",
  },
});
