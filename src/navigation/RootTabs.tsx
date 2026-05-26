import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { Session } from "@supabase/supabase-js";
import React, { useEffect, useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SyncStatus from "../components/SyncStatus";
import AttendanceScreen from "../screens/AttendanceScreen";
import InventExpImportScreen from "../screens/InventExpImportScreen";
import ReportAScreen from "../screens/ReportAScreen";
import ReportBScreen from "../screens/ReportBScreen";
import ReportFarmacondeScreen from "../screens/ReportFarmacondeScreen";
import AcompanhamentoScreen from "../screens/AcompanhamentoScreen";
import AuthScreen from "../screens/AuthScreen";
import ManagementScreen from "../screens/ManagementScreen";
import EscalaDashboardScreen from "../screens/EscalaDashboardScreen";
import CheckersScreen from "../screens/CheckersScreen";
import InventoryDivergenceScreen from "../screens/InventoryDivergenceScreen";
import { isSupabaseConfigured, supabase } from "../services/supabase";

import AppLogo from "../components/AppLogo";

// Metro automatically resolves ScannerScreen.web.tsx on web (stub)
// and ScannerScreen.tsx on native
import ScannerScreen from "../screens/ScannerScreen";

export type RootTabParamList = {
  ReportA: undefined;
  ReportB: undefined;
  Attendance: undefined;
  Escala: undefined;
  InventExp: undefined;
  Management: undefined;
  Scanner: undefined;
  Acompanhamento: undefined;
  ReportFarmaconde: undefined;
  Checkers: undefined;
  InventoryDivergence: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootTabs() {
  const showScanner = Platform.OS !== "web";
  const [session, setSession] = useState<Session | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession);
    }).catch(() => null);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      setSession(activeSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: "#2563EB" },
        headerTintColor: "#fff",
        headerTitle: (props) => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <AppLogo size={24} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
              {props.children}
            </Text>
          </View>
        ),
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <SyncStatus />
            {isSupabaseConfigured && session ? (
              <Pressable
                onPress={() => void supabase?.auth.signOut()}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  gap: 4,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "500" }}>Sair</Text>
                <Ionicons name="log-out-outline" size={18} color="#fff" />
              </Pressable>
            ) : null}
          </View>
        ),
        tabBarActiveTintColor: "#2563EB",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#E2E8F0",
          elevation: 0,
          shadowOpacity: 0,
          height: Platform.OS === "web" ? 56 : 60 + insets.bottom,
          paddingBottom: Platform.OS === "android" ? Math.max(insets.bottom, 8) : insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
        },
        tabBarIcon: ({ color, size }) => {
            const iconMap: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
              ReportA: "clipboard",
              ReportB: "document-text",
              Attendance: "checkmark-circle-outline",
              Escala: "calendar",
              InventExp: "analytics",
              Management: "briefcase",
              Scanner: "scan",
              Acompanhamento: "list-outline",
              ReportFarmaconde: "medkit",
              Checkers: "people-circle-outline",
              InventoryDivergence: "git-compare-outline",
            };
          const iconName = iconMap[route.name as keyof RootTabParamList] ?? "clipboard";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Acompanhamento" component={AcompanhamentoScreen} options={{ title: "Acompanhamento" }} />
      <Tab.Screen name="ReportA" component={ReportAScreen} options={{ title: "Geral", tabBarButton: () => null }} />
      <Tab.Screen name="ReportFarmaconde" component={ReportFarmacondeScreen} options={{ title: "FARMACONDE", tabBarButton: () => null }} />
      <Tab.Screen name="ReportB" component={ReportBScreen} options={{ title: "Resumo" }} />
      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{ title: "Controle de Escala", tabBarLabel: "Presenças" }}
      />
      <Tab.Screen name="Escala" component={EscalaDashboardScreen} options={{ title: "Escala" }} />
      <Tab.Screen name="Checkers" component={CheckersScreen} options={{ title: "Conferentes" }} />
      <Tab.Screen name="InventExp" component={InventExpImportScreen} options={{ title: "Avaliação" }} />
      <Tab.Screen name="Management" component={ManagementScreen} options={{ title: "Gestão" }} />
      <Tab.Screen
        name="InventoryDivergence"
        component={InventoryDivergenceScreen}
        options={{ title: "Divergências", tabBarButton: () => null }}
      />
      {showScanner ? (
        <Tab.Screen name="Scanner" component={ScannerScreen} options={{ title: "Scanner" }} />
      ) : null}
    </Tab.Navigator>
  );
}
