import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { Session } from "@supabase/supabase-js";
import React, { useEffect, useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";

// Importações dos componentes e telas
import SyncStatus from "../../src/components/SyncStatus";
import AttendanceScreen from "../screens/AttendanceScreen";
import ReportAScreen from "../screens/ReportAScreen";
import ReportBScreen from "../screens/ReportBScreen";
import ScannerScreen from "../screens/ScannerScreen";
import { isSupabaseConfigured, supabase } from "../services/supabase";

export type RootTabParamList = {
  ReportA: undefined;
  ReportB: undefined;
  Attendance: undefined;
  Scanner: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootTabs() {
  const showScanner = Platform.OS !== "web";
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: "#2563EB" },
        headerTintColor: "#fff",
        headerTitle: (props) => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Image
              source={require("../../assets/images/icon.png")}
              style={{ width: 24, height: 24, tintColor: "#fff" }}
            />
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
              {props.children}
            </Text>
          </View>
        ),
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* O SyncStatus mostra se o app está online/sincronizado */}
            <SyncStatus />
            {isSupabaseConfigured && session ? (
              <Pressable
                onPress={() => void supabase?.auth.signOut()}
                style={{ paddingHorizontal: 12 }}
              >
                <Ionicons name="log-out-outline" size={20} color="#fff" />
              </Pressable>
            ) : null}
          </View>
        ),
        tabBarActiveTintColor: "#2563EB",
        tabBarStyle: { backgroundColor: "#fff" },
        tabBarIcon: ({ color, size }) => {
          const iconMap: Record<
            keyof RootTabParamList,
            keyof typeof Ionicons.glyphMap
          > = {
            ReportA: "clipboard",
            ReportB: "document-text",
            Attendance: "people",
            Scanner: "scan",
          };
          const iconName =
            iconMap[route.name as keyof RootTabParamList] ?? "clipboard";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="ReportA"
        component={ReportAScreen}
        options={{ title: "Andamento" }}
      />
      <Tab.Screen
        name="ReportB"
        component={ReportBScreen}
        options={{ title: "Resumo" }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{ title: "Escala" }}
      />
      {showScanner ? (
        <Tab.Screen
          name="Scanner"
          component={ScannerScreen}
          options={{ title: "Scanner" }}
        />
      ) : null}
    </Tab.Navigator>
  );
}
