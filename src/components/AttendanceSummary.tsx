import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { supabase } from "../services/supabase"; // Ajuste o caminho conforme seu projeto

interface AttendanceData {
  id: string;
  loja: string;
  data: string;
  total_colaboradores: number;
  presentes: number;
  created_at: string;
}

export default function AttendanceSummary() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<AttendanceData[]>([]);

  useEffect(() => {
    fetchAttendance();
  }, []);

  async function fetchAttendance() {
    // 1. Verificação de segurança para o TypeScript
    if (!supabase) return;

    try {
      setLoading(true);
      // Agora o TypeScript sabe que o supabase existe aqui
      const { data, error } = await supabase
        .from("attendance_stats")
        .select("*");

      if (error) throw error;
      if (data) setReports(data);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  const renderItem = ({ item }: { item: AttendanceData }) => {
    const faltas = item.total_colaboradores - item.presentes;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.lojaText}>{item.loja}</Text>
          <Text style={styles.dateText}>
            {new Date(item.data).toLocaleDateString("pt-BR")}
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{item.total_colaboradores}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statBox, styles.borderLeft]}>
            <Text style={[styles.statValue, { color: "#2ecc71" }]}>
              {item.presentes}
            </Text>
            <Text style={styles.statLabel}>Presentes</Text>
          </View>
          <View style={[styles.statBox, styles.borderLeft]}>
            <Text style={[styles.statValue, { color: "#e74c3c" }]}>
              {faltas}
            </Text>
            <Text style={styles.statLabel}>Faltas</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <ActivityIndicator
        size="large"
        color="#0047AB"
        style={{ marginTop: 20 }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Relatórios de Presença</Text>
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA", // Fundo leve para destacar o branco
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0047AB", // Azul Profissional
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 3, // Sombra Android
    shadowColor: "#000", // Sombra iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E1E8EE",
    paddingBottom: 8,
    marginBottom: 12,
  },
  lojaText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  dateText: {
    fontSize: 14,
    color: "#666",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  borderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: "#E1E8EE",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0047AB",
  },
  statLabel: {
    fontSize: 12,
    color: "#7F8C8D",
    marginTop: 2,
  },
});
