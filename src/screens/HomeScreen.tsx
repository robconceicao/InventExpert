import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  canAccessManagement,
  canGenerateEscala,
  resolveAppRole,
} from "../services/authz";
import { useLicense } from "../services/licenseContext";

type Nav = NativeStackNavigationProp<RootStackParamList, "Home">;

type MenuItem = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: keyof RootStackParamList;
  hideOnWeb?: boolean;
  requiredFeature?: string;
};

const PRIMARY_ITEMS: MenuItem[] = [
  {
    title: "Acompanhamento",
    subtitle: "Relatórios operacionais por segmento (A–F)",
    icon: "clipboard-outline",
    color: "#2563EB",
    route: "AcompanhamentoMenu",
    requiredFeature: "inventory_basic",
  },
  {
    title: "Resumo",
    subtitle: "Modelos de resumo por segmento (G–J)",
    icon: "document-text-outline",
    color: "#7C3AED",
    route: "ResumoMenu",
    requiredFeature: "report_b",
  },
];

const INTEGRATION_ITEMS: MenuItem[] = [
  {
    title: "Presenças",
    subtitle: "Controle de presença da equipe",
    icon: "checkmark-circle-outline",
    color: "#059669",
    route: "Attendance",
    requiredFeature: "presence",
  },
  {
    title: "Escala",
    subtitle: "Dashboard e gestão de escala",
    icon: "calendar-outline",
    color: "#D97706",
    route: "Escala",
    requiredFeature: "schedules",
  },
  {
    title: "Avaliação",
    subtitle: "Importação e avaliação de conferentes",
    icon: "analytics-outline",
    color: "#DC2626",
    route: "InventExp",
    requiredFeature: "evaluation_v3",
  },
  {
    title: "Auditoria",
    subtitle: "Atribuição e reconciliação AAE",
    icon: "shield-checkmark-outline",
    color: "#0891B2",
    route: "AuditoriaAAE",
    requiredFeature: "advanced_audit",
  },
  {
    title: "Gestão",
    subtitle: "Clientes, colaboradores e inventários",
    icon: "briefcase-outline",
    color: "#4F46E5",
    route: "Management",
  },
  {
    title: "Scanner",
    subtitle: "Leitura de documentos e formulários",
    icon: "scan-outline",
    color: "#64748B",
    route: "Scanner",
    hideOnWeb: true,
    requiredFeature: "document_scanner",
  },
];

function MenuButton({
  item,
  onPress,
  locked,
}: {
  item: MenuItem;
  onPress: () => void;
  locked: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, locked && styles.cardLocked, pressed && styles.cardPressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${item.color}18` }]}>
        <Ionicons name={item.icon} size={28} color={locked ? "#94A3B8" : item.color} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, locked && styles.lockedText]}>{item.title}</Text>
        <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
        {locked ? <Text style={styles.planHint}>Disponível em um plano superior</Text> : null}
      </View>
      <Ionicons name={locked ? "lock-closed-outline" : "chevron-forward"} size={20} color="#94A3B8" />
    </Pressable>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { license, hasFeature } = useLicense();
  const integrations = INTEGRATION_ITEMS.filter(
    (i) => !(i.hideOnWeb && Platform.OS === "web"),
  );

  const isLocked = useCallback(
    (item: MenuItem) => Boolean(license && item.requiredFeature && !hasFeature(item.requiredFeature)),
    [hasFeature, license],
  );

  const navigateTo = useCallback(
    async (item: MenuItem) => {
      if (isLocked(item)) {
        Alert.alert(
          "Recurso não incluído no seu plano",
          `O módulo ${item.title} não está liberado no plano ${license?.plan ?? "atual"}. Consulte os planos na Tadeu Apps para fazer upgrade.`,
        );
        return;
      }

      const route = item.route;
      if (route === "Management" || route === "Escala") {
        const role = await resolveAppRole();
        const allowed =
          route === "Management"
            ? canAccessManagement(role)
            : canGenerateEscala(role);
        if (!allowed) {
          Alert.alert(
            "Acesso restrito",
            "Esta área requer perfil LIDER ou ADMIN. " +
              "Peça a um administrador para actualizar o seu papel em app_profiles.",
          );
          return;
        }
      }
      navigation.navigate(route);
    },
    [isLocked, license?.plan, navigation],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>InventExpert</Text>
            <Text style={styles.hint}>
              Selecione um módulo. Toda a navegação parte desta tela — sem menu no rodapé.
            </Text>
          </View>
          {license ? (
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{license.plan.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>Inventário</Text>
        {PRIMARY_ITEMS.map((item) => (
          <MenuButton
            key={item.route}
            item={item}
            locked={isLocked(item)}
            onPress={() => void navigateTo(item)}
          />
        ))}

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Integrações</Text>
        {integrations.map((item) => (
          <MenuButton
            key={item.route}
            item={item}
            locked={isLocked(item)}
            onPress={() => void navigateTo(item)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F1F5F9" },
  scroll: { padding: 16, paddingBottom: 40 },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  greeting: { fontSize: 22, fontWeight: "800", color: "#0F172A", marginBottom: 4 },
  hint: { fontSize: 13, color: "#64748B", marginBottom: 20, lineHeight: 18 },
  planBadge: { backgroundColor: "#DBEAFE", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  planBadgeText: { color: "#1D4ED8", fontSize: 11, fontWeight: "800" },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E2E8F0", gap: 12 },
  cardLocked: { backgroundColor: "#F8FAFC", opacity: 0.82 },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  iconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  lockedText: { color: "#64748B" },
  cardSubtitle: { fontSize: 12, color: "#64748B", marginTop: 2, lineHeight: 16 },
  planHint: { marginTop: 4, fontSize: 11, color: "#B45309", fontWeight: "700" },
});
