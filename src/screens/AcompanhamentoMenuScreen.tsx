import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList, "AcompanhamentoMenu">;

type ReportItem = {
  title: string;
  subtitle: string;
  reportKey: "ReportA" | "ReportB" | "ReportC" | "ReportD" | "ReportE" | "ReportF";
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const ITEMS: ReportItem[] = [
  {
    title: "DSP",
    subtitle: "Acompanhamento de Inventário — DSP",
    reportKey: "ReportA",
    icon: "storefront-outline",
    color: "#2563EB",
  },
  {
    title: "Farmaconde",
    subtitle: "Inventário, mapeamento e divergências",
    reportKey: "ReportB",
    icon: "medkit-outline",
    color: "#059669",
  },
  {
    title: "Farmácias em Geral",
    subtitle: "Acompanhamento completo de farmácias",
    reportKey: "ReportC",
    icon: "medical-outline",
    color: "#7C3AED",
  },
  {
    title: "Mercados",
    subtitle: "Exceto Atacado e Hipermercados",
    reportKey: "ReportD",
    icon: "cart-outline",
    color: "#D97706",
  },
  {
    title: "Outros Estabelecimentos",
    subtitle: "Modelo simplificado para demais segmentos",
    reportKey: "ReportE",
    icon: "business-outline",
    color: "#0891B2",
  },
  {
    title: "Assaí",
    subtitle: "Acompanhamento de Inventário — Assaí",
    reportKey: "ReportF",
    icon: "cube-outline",
    color: "#DC2626",
  },
];

export default function AcompanhamentoMenuScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hint}>
          Escolha o tipo/segmento do relatório de acompanhamento.
        </Text>
        {ITEMS.map((item) => (
          <Pressable
            key={item.reportKey}
            onPress={() => navigation.navigate(item.reportKey)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${item.color}18` }]}>
              <Ionicons name={item.icon} size={26} color={item.color} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F1F5F9" },
  scroll: { padding: 16, paddingBottom: 40 },
  hint: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 16,
    lineHeight: 18,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  cardPressed: { opacity: 0.85 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  cardSubtitle: { fontSize: 12, color: "#64748B", marginTop: 2 },
});
