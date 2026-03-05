import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { INVENTORY_PROFILES } from "../config/inventoryEvalConfig";
import type {
  InventoryCheckerEvaluation,
  InventoryOperationType,
} from "../types";

interface CheckerFeedbackReportProps {
  evaluation: InventoryCheckerEvaluation;
  operationType: InventoryOperationType;
}

export function CheckerFeedbackReport({
  evaluation,
  operationType,
}: CheckerFeedbackReportProps) {
  const profile = INVENTORY_PROFILES[operationType];
  const { targets, alerts } = profile;

  const { input, pctErro, pctBloco, nivelColor, nivel, tags, scoreFinal } =
    evaluation;

  const pct1a1 = 100 - pctBloco;

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
  if (pctErro <= targets.erroTolerancia && input.produtividade > targets.productivity) {
    mensagens.push(
      "Você recebeu bônus por manter boa qualidade mesmo com produtividade acima da meta.",
    );
  }
  if (pctErro > 1.5 && pctBloco > alerts.criticalBlockLimit) {
    mensagens.push(
      "Foi identificado risco de contagem superficial (erro alto com muito bloco).",
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

      {tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Como a sua nota foi calculada</Text>
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
  explanationText: {
    fontSize: 13,
    color: "#334155",
  },
});

