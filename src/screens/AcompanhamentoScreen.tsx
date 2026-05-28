import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RootTabParamList } from "../navigation/RootTabs";

type NavigationProp = BottomTabNavigationProp<RootTabParamList, "Acompanhamento">;

export default function AcompanhamentoScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Selecione o tipo de relatório</Text>

      <TouchableOpacity
        style={[styles.card, styles.cardGeral]}
        onPress={() => navigation.navigate("ReportA")}
      >
        <Ionicons name="clipboard" size={32} color="#fff" />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Geral</Text>
          <Text style={styles.cardDescription}>Acompanhamento Padrão</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, styles.cardFarmaconde]}
        onPress={() => navigation.navigate("ReportFarmaconde")}
      >
        <Ionicons name="medkit" size={32} color="#fff" />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>FARMACONDE</Text>
          <Text style={styles.cardDescription}>Relatório Específico</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, styles.cardDivergencias]}
        onPress={() => navigation.navigate("InventoryDivergence")}
      >
        <Ionicons name="git-compare-outline" size={32} color="#fff" />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Resultado Final</Text>
          <Text style={styles.cardDescription}>Análise de Divergências e Causas</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 24,
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardGeral: {
    backgroundColor: "#2563EB", // Blue
  },
  cardFarmaconde: {
    backgroundColor: "#059669", // Emerald green for Farma
  },
  cardDivergencias: {
    backgroundColor: "#7C3AED", // Violet for inventory divergence
  },
  cardContent: {
    flex: 1,
    marginLeft: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  cardDescription: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
});
