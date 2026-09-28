import { Ionicons } from "@expo/vector-icons";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Session } from "@supabase/supabase-js";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, Platform, Pressable, Text, View } from "react-native";

import SyncStatus from "../components/SyncStatus";
import AcompanhamentoMenuScreen from "../screens/AcompanhamentoMenuScreen";
import AttendanceScreen from "../screens/AttendanceScreen";
import AuditoriaAtribuicaoScreen from "../screens/AuditoriaAtribuicaoScreen";
import AuthScreen from "../screens/AuthScreen";
import RedefinirSenhaScreen from "../screens/RedefinirSenhaScreen";
import EscalaDashboardScreen from "../screens/EscalaDashboardScreen";
import HomeScreen from "../screens/HomeScreen";
import InventExpImportScreen from "../screens/InventExpImportScreen";
import ManagementScreen from "../screens/ManagementScreen";
import ReportAScreen from "../screens/ReportAScreen";
import ReportBScreen from "../screens/ReportBScreen";
import ReportCScreen from "../screens/ReportCScreen";
import ReportDScreen from "../screens/ReportDScreen";
import ReportEScreen from "../screens/ReportEScreen";
import ReportFScreen from "../screens/ReportFScreen";
import ReportGScreen from "../screens/ReportGScreen";
import ReportHScreen from "../screens/ReportHScreen";
import ReportIScreen from "../screens/ReportIScreen";
import ReportJScreen from "../screens/ReportJScreen";
import ResumoMenuScreen from "../screens/ResumoMenuScreen";
import ScannerScreen from "../screens/ScannerScreen";
import TadeuLicenseScreen from "../screens/TadeuLicenseScreen";
import { LicenseProvider } from "../services/licenseContext";
import { isSupabaseConfigured, supabase } from "../services/supabase";
import { registerDefaultSyncHandlers } from "../services/syncHandlers";
import { syncQueue } from "../services/sync";
import {
  fetchTadeuLicense,
  type TadeuLicense,
} from "../services/tadeuLicense";
import { parseRecoveryLink, type RecoveryLink } from "../utils/recoveryLink";

/**
 * Lê a URL de entrada sem esperar, quando dá.
 *
 * Na web ela está em `window.location` desde o primeiro render — e é o caso que
 * importa, porque o link do e-mail abre no navegador. Resolver de forma
 * síncrona evita piscar a tela de login antes da de redefinição.
 */
function lerLinkDeEntrada(): RecoveryLink {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return parseRecoveryLink(window.location?.href);
  }
  return { tipo: "ausente" };
}

export type RootStackParamList = {
  Home: undefined;
  AcompanhamentoMenu: undefined;
  ResumoMenu: undefined;
  ReportA: undefined;
  ReportB: undefined;
  ReportC: undefined;
  ReportD: undefined;
  ReportE: undefined;
  ReportF: undefined;
  ReportG: undefined;
  ReportH: undefined;
  ReportI: undefined;
  ReportJ: undefined;
  Attendance: undefined;
  Escala: undefined;
  InventExp: undefined;
  Management: undefined;
  Scanner: undefined;
  AuditoriaAAE: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HeaderRight({ session }: { session: Session | null }) {
  return (
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
  );
}

function HeaderTitle({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Image
        source={require("../../assets/images/icon.png")}
        style={{ width: 24, height: 24, tintColor: "#fff" }}
      />
      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [license, setLicense] = useState<TadeuLicense | null>(null);
  const [licenseLoading, setLicenseLoading] = useState(true);
  const [linkRecuperacao, setLinkRecuperacao] =
    useState<RecoveryLink>(lerLinkDeEntrada);

  const refreshLicense = useCallback(async () => {
    setLicenseLoading(true);
    try {
      const next = await fetchTadeuLicense();
      setLicense(next);
    } catch {
      setLicense(null);
    } finally {
      setLicenseLoading(false);
    }
  }, []);

  // No nativo a URL inicial só chega de forma assíncrona. Hoje não há deep link
  // configurado (SPEC 0006, Q2), então isto não dispara — fica pronto para o dia
  // em que disparar, sem custo para a web.
  useEffect(() => {
    if (Platform.OS === "web") return;
    let vivo = true;
    Linking.getInitialURL()
      .then((url) => {
        if (!vivo || !url) return;
        const link = parseRecoveryLink(url);
        if (link.tipo !== "ausente") setLinkRecuperacao(link);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    registerDefaultSyncHandlers();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      if (data.session) {
        void syncQueue();
        void refreshLicense();
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        void syncQueue();
        void refreshLicense();
      } else {
        setLicense(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [refreshLicense]);

  // Antes da sessão, e de propósito. Quem chega por link de recuperação não tem
  // sessão — foi este early return que mandou o link do e-mail para a tela de
  // login. E vem antes também porque `setSession()` na tela de redefinição
  // dispara `onAuthStateChange`: sem esta precedência, o app entraria sozinho no
  // meio da troca de senha.
  if (linkRecuperacao.tipo !== "ausente") {
    return (
      <RedefinirSenhaScreen
        link={linkRecuperacao}
        onConcluir={() => {
          // Some com o fragmento, senão recarregar a página reabre esta tela
          // com um token já gasto.
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.history?.replaceState?.(null, "", window.location.pathname);
          }
          setLinkRecuperacao({ tipo: "ausente" });
        }}
      />
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (licenseLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC" }}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 12, color: "#475569" }}>Validando licença Tadeu Apps…</Text>
      </View>
    );
  }

  if (!license) {
    return <TadeuLicenseScreen onActivated={() => void refreshLicense()} />;
  }

  return (
    <LicenseProvider license={license} refresh={refreshLicense}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: "#2563EB" },
          headerTintColor: "#fff",
          headerTitle: (props) => <HeaderTitle>{props.children}</HeaderTitle>,
          headerRight: () => <HeaderRight session={session} />,
          headerBackTitle: "Voltar",
          contentStyle: { backgroundColor: "#F8FAFC" },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Início" }} />
        <Stack.Screen name="AcompanhamentoMenu" component={AcompanhamentoMenuScreen} options={{ title: "Acompanhamento" }} />
        <Stack.Screen name="ResumoMenu" component={ResumoMenuScreen} options={{ title: "Resumo" }} />
        <Stack.Screen name="ReportA" component={ReportAScreen} options={{ title: "DSP" }} />
        <Stack.Screen name="ReportB" component={ReportBScreen} options={{ title: "Farmaconde" }} />
        <Stack.Screen name="ReportC" component={ReportCScreen} options={{ title: "Farmácias em Geral" }} />
        <Stack.Screen name="ReportD" component={ReportDScreen} options={{ title: "Mercados" }} />
        <Stack.Screen name="ReportE" component={ReportEScreen} options={{ title: "Outros Estabelecimentos" }} />
        <Stack.Screen name="ReportF" component={ReportFScreen} options={{ title: "Assaí" }} />
        <Stack.Screen name="ReportG" component={ReportGScreen} options={{ title: "Resumo Final" }} />
        <Stack.Screen name="ReportH" component={ReportHScreen} options={{ title: "Resumo Farmaconde" }} />
        <Stack.Screen name="ReportI" component={ReportIScreen} options={{ title: "Resumo Mercados" }} />
        <Stack.Screen name="ReportJ" component={ReportJScreen} options={{ title: "Demais Estabelecimentos" }} />
        <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ title: "Presenças" }} />
        <Stack.Screen name="Escala" component={EscalaDashboardScreen} options={{ title: "Escala" }} />
        <Stack.Screen name="InventExp" component={InventExpImportScreen} options={{ title: "Avaliação" }} />
        <Stack.Screen name="AuditoriaAAE" component={AuditoriaAtribuicaoScreen} options={{ title: "Auditoria" }} />
        <Stack.Screen name="Management" component={ManagementScreen} options={{ title: "Gestão" }} />
        <Stack.Screen name="Scanner" component={ScannerScreen} options={{ title: "Scanner" }} />
      </Stack.Navigator>
    </LicenseProvider>
  );
}
