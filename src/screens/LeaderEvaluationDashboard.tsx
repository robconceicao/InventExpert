import { useNavigation } from "@react-navigation/native";
import React, { useLayoutEffect, useMemo, useState } from "react";
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { CheckerFeedbackReport } from "../components/CheckerFeedbackReport";
import { INVENTORY_PROFILES } from "../config/inventoryEvalConfig";
import {
    evaluateChecker,
    sortRanking,
} from "../services/InventoryEvaluationService";
import type {
    InventoryCheckerEvaluation,
    InventoryCheckerInput,
    InventoryOperationType,
} from "../types";

const SAMPLE_CHECKERS: InventoryCheckerInput[] = [
  { nome: "Ana Souza", qtde: 3200, qtde1a1: 2900, produtividade: 950, erro: 4 },
  {
    nome: "Bruno Lima",
    qtde: 2800,
    qtde1a1: 1700,
    produtividade: 1100,
    erro: 12,
  },
  {
    nome: "Carlos Silva",
    qtde: 1500,
    qtde1a1: 1400,
    produtividade: 780,
    erro: 1,
  },
  {
    nome: "Daniela Costa",
    qtde: 2200,
    qtde1a1: 1600,
    produtividade: 890,
    erro: 9,
  },
  {
    nome: "Eduardo Alves",
    qtde: 2600,
    qtde1a1: 2000,
    produtividade: 1020,
    erro: 7,
  },
];

export default function LeaderEvaluationDashboard() {
  const navigation = useNavigation();
  const [operationType, setOperationType] =
    useState<InventoryOperationType>("FARMACIA");

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const evaluated = useMemo<InventoryCheckerEvaluation[]>(() => {
    return SAMPLE_CHECKERS.map((c) => evaluateChecker(c, operationType));
  }, [operationType]);

  const ranking = useMemo(() => sortRanking(evaluated), [evaluated]);

  const top3 = ranking.slice(0, 3);

  const radarRisco = ranking.filter(
    (e) =>
      e.nivel === "CRITICO" ||
      e.tags.includes("🚨 Risco de Contagem Superficial"),
  );

  const profile = INVENTORY_PROFILES[operationType];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E5F0FF" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Avaliação de Conferentes</Text>
        <Text style={styles.subtitle}>
          Visão do líder de inventário com ranking e radar de risco.
        </Text>

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

        <View style={styles.profileInfo}>
          <Text style={styles.profileTitle}>Perfil selecionado</Text>
          <Text style={styles.profileLine}>
            Meta produtividade: {profile.targets.productivity} itens/h
          </Text>
          <Text style={styles.profileLine}>
            Limite bloco: {profile.targets.maxBlockLimit}% | Erro tolerância:{" "}
            {profile.targets.erroTolerancia}%
          </Text>
          <Text style={styles.profileLine}>
            Erro crítico: {profile.targets.erroCritico}% | Bloco crítico:{" "}
            {profile.alerts.criticalBlockLimit}%
          </Text>
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
          <Text style={styles.cardTitle}>Ranking geral</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 0.4 }]}>#</Text>
            <Text style={[styles.th, { flex: 1.6 }]}>Conferente</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>Score</Text>
            <Text style={[styles.th, { flex: 0.9 }]}>% Erro</Text>
            <Text style={[styles.th, { flex: 1.1 }]}>Prod/h</Text>
            <Text style={[styles.th, { flex: 1 }]}>Bloco%</Text>
          </View>
          {ranking.map((ev, index) => (
            <View key={ev.input.nome} style={styles.tableRow}>
              <Text style={[styles.tdRank, { flex: 0.4 }]}>{index + 1}º</Text>
              <Text style={[styles.tdNome, { flex: 1.6 }]}>
                {ev.input.nome}
              </Text>
              <Text
                style={[styles.tdScore, { flex: 0.8, color: ev.nivelColor }]}
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
            </View>
          ))}
        </View>

        {radarRisco.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Radar de risco</Text>
            <Text style={styles.cardSubtitle}>
              Conferentes com risco de contagem superficial ou classificação
              crítica.
            </Text>
            {radarRisco.map((ev) => (
              <View key={ev.input.nome} style={styles.riskRow}>
                <View style={styles.riskHeader}>
                  <View
                    style={[styles.riskDot, { backgroundColor: ev.nivelColor }]}
                  />
                  <Text style={styles.riskName}>{ev.input.nome}</Text>
                  <Text style={styles.riskScore}>{ev.scoreFinal}</Text>
                </View>
                <Text style={styles.riskMeta}>
                  % Erro: {ev.pctErro.toFixed(2)}% | Bloco:{" "}
                  {ev.pctBloco.toFixed(1)}% | Prod/h: {ev.input.produtividade}
                </Text>
                {ev.tags.length > 0 && (
                  <Text style={styles.riskTags}>{ev.tags.join(" · ")}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {ranking[0] && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Exemplo de recibo do conferente
            </Text>
            <CheckerFeedbackReport
              evaluation={ranking[0]}
              operationType={operationType}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#E5F0FF",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
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
  profileInfo: {
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    padding: 12,
    gap: 2,
  },
  profileTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  profileLine: {
    fontSize: 12,
    color: "#475569",
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
});
