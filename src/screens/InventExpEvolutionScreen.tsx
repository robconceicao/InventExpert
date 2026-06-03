import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getEvolucaoConferente,
  getEvolucaoEquipe,
  listarNomesHistorico,
} from "../services/AvaliacaoHistoricoService";
import type { EvolucaoPeriodo } from "../types";
import { shareEvolucaoReportPdf } from "../utils/exportPdf";

const PERIODOS: { id: EvolucaoPeriodo; label: string }[] = [
  { id: "DIARIO", label: "Diário" },
  { id: "QUINZENAL", label: "Quinzenal" },
  { id: "MENSAL", label: "Mensal" },
];

export default function InventExpEvolutionScreen() {
  const navigation = useNavigation();
  const [periodo, setPeriodo] = useState<EvolucaoPeriodo>("QUINZENAL");
  const [nomes, setNomes] = useState<string[]>([]);
  const [nomeSel, setNomeSel] = useState("");
  const [busca, setBusca] = useState("");
  const [detalhe, setDetalhe] = useState<string>("");
  const [equipe, setEquipe] = useState<string>("");
  const [tab, setTab] = useState<"individual" | "equipe">("individual");

  useEffect(() => {
    void listarNomesHistorico().then((lista) => {
      setNomes(lista);
      if (lista.length > 0) setNomeSel((prev) => prev || lista[0]);
    });
  }, []);

  useEffect(() => {
    void (async () => {
      if (tab === "individual" && nomeSel) {
        const evo = await getEvolucaoConferente(nomeSel, periodo);
        if (!evo) {
          setDetalhe("Sem histórico para este conferente. Processe uma avaliação na aba Avaliação.");
          return;
        }
        let t = `${evo.nome}\nTendência: ${evo.tendencia} (${evo.variacaoScore >= 0 ? "+" : ""}${evo.variacaoScore} pts)\n\n`;
        for (const p of evo.periodos) {
          t += `${p.label}: score ${p.scoreMedio} | erro ${p.erroMedio}% | prod ${p.prodMedia}/h | ${p.totalInventarios} inv.\n`;
        }
        setDetalhe(t);
      } else if (tab === "equipe") {
        const rows = await getEvolucaoEquipe(periodo);
        if (rows.length === 0) {
          setEquipe("Sem histórico da equipe.");
          return;
        }
        let t = "Conferente | Atual | Anterior | Tendência\n";
        for (const r of rows) {
          const ant = r.scoreAnterior !== null ? String(r.scoreAnterior) : "—";
          const icon =
            r.tendencia === "MELHORA" ? "📈" : r.tendencia === "PIORA" ? "📉" : "➡️";
          t += `${r.nome} | ${r.scoreAtual} | ${ant} | ${icon} ${r.tendencia}\n`;
        }
        setEquipe(t);
      }
    })();
  }, [tab, nomeSel, periodo]);

  const nomesFiltrados = nomes.filter((n) =>
    n.toLowerCase().includes(busca.toLowerCase()),
  );

  const exportarPdf = async () => {
    const corpo = tab === "individual" ? detalhe : equipe;
    if (!corpo || corpo.startsWith("Sem")) {
      Alert.alert("Sem dados", "Não há evolução para exportar.");
      return;
    }
    try {
      await shareEvolucaoReportPdf(
        `Evolução — ${tab === "individual" ? nomeSel : "Equipe"} (${periodo})`,
        corpo,
      );
    } catch {
      Alert.alert("Erro", "Não foi possível gerar o PDF.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Evolução da Avaliação</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.segmentRow}>
          {PERIODOS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setPeriodo(p.id)}
              style={[styles.segment, periodo === p.id && styles.segmentActive]}
            >
              <Text
                style={[
                  styles.segmentText,
                  periodo === p.id && styles.segmentTextActive,
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setTab("individual")}
            style={[styles.tab, tab === "individual" && styles.tabActive]}
          >
            <Text style={tab === "individual" ? styles.tabTextActive : styles.tabText}>
              Individual
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("equipe")}
            style={[styles.tab, tab === "equipe" && styles.tabActive]}
          >
            <Text style={tab === "equipe" ? styles.tabTextActive : styles.tabText}>
              Equipe
            </Text>
          </Pressable>
        </View>

        {tab === "individual" && (
          <>
            <TextInput
              placeholder="Buscar conferente..."
              value={busca}
              onChangeText={setBusca}
              style={styles.input}
            />
            <ScrollView horizontal style={styles.chips}>
              {nomesFiltrados.map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setNomeSel(n)}
                  style={[styles.chip, nomeSel === n && styles.chipActive]}
                >
                  <Text
                    style={nomeSel === n ? styles.chipTextActive : styles.chipText}
                    numberOfLines={1}
                  >
                    {n}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.body}>{detalhe}</Text>
          </>
        )}

        {tab === "equipe" && <Text style={styles.body}>{equipe}</Text>}

        <Pressable onPress={() => void exportarPdf()} style={styles.btnPdf}>
          <Ionicons name="document-outline" size={18} color="#fff" />
          <Text style={styles.btnPdfText}>Exportar evolução (PDF)</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    padding: 12,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "600" },
  scroll: { padding: 16, gap: 12 },
  segmentRow: { flexDirection: "row", gap: 8 },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
  },
  segmentActive: { backgroundColor: "#2563EB" },
  segmentText: { fontSize: 12, color: "#475569" },
  segmentTextActive: { color: "#fff", fontWeight: "600" },
  tabRow: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  tabActive: { borderWidth: 2, borderColor: "#2563EB" },
  tabText: { color: "#64748b" },
  tabTextActive: { color: "#2563EB", fontWeight: "600" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    fontSize: 14,
  },
  chips: { maxHeight: 44 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    marginRight: 8,
    maxWidth: 180,
  },
  chipActive: { backgroundColor: "#2563EB" },
  chipText: { fontSize: 12, color: "#475569" },
  chipTextActive: { color: "#fff", fontSize: 12 },
  body: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: "#0f172a",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 20,
  },
  btnPdf: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1d4ed8",
    padding: 12,
    borderRadius: 999,
    marginTop: 8,
  },
  btnPdfText: { color: "#fff", fontWeight: "600" },
});
