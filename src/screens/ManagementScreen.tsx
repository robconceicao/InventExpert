import React, { useState } from "react";
import {
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// Importaremos os componentes de lista nos próximos passos
import ClientesList from "../components/management/ClientesList";
import ColaboradoresList from "../components/management/ColaboradoresList";
import InventariosList from "../components/management/InventariosList";

type Tab = "CLIENTES" | "COLABORADORES" | "INVENTARIOS";

export default function ManagementScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("CLIENTES");

  return (
    <SafeAreaView style={styles.container}>
      {/* Segmented Control / Tabs Header */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === "CLIENTES" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("CLIENTES")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "CLIENTES" && styles.tabTextActive,
            ]}
          >
            Clientes
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabButton,
            activeTab === "COLABORADORES" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("COLABORADORES")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "COLABORADORES" && styles.tabTextActive,
            ]}
          >
            Colaboradores
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabButton,
            activeTab === "INVENTARIOS" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("INVENTARIOS")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "INVENTARIOS" && styles.tabTextActive,
            ]}
          >
            Inventários
          </Text>
        </Pressable>
      </View>

      {/* Content Area */}
      <View style={styles.content}>
        {activeTab === "CLIENTES" && <ClientesList />}
        {activeTab === "COLABORADORES" && <ColaboradoresList />}
        {activeTab === "INVENTARIOS" && <InventariosList />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    ...(Platform.OS === "web" ? { gap: 8 } : {}),
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    marginHorizontal: Platform.OS !== "web" ? 4 : 0,
  },
  tabButtonActive: {
    backgroundColor: "#EFF6FF",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#2563EB",
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
});
