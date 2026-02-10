import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isSupabaseConfigured, supabase } from "../services/supabase";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const trimmedEmail = useMemo(() => email.trim(), [email]);

  const translateAuthError = (message: string) => {
    if (message.includes("Email not confirmed"))
      return "E-mail não confirmado. Verifique seu spam.";
    if (message.includes("Invalid login credentials"))
      return "E-mail ou senha inválidos.";
    if (message.includes("User already registered"))
      return "E-mail já cadastrado.";
    return message;
  };

  const handleSignIn = async () => {
    if (!supabase) return Alert.alert("Erro", "Supabase não configurado.");
    if (!trimmedEmail || !password)
      return Alert.alert("Aviso", "Preencha todos os campos.");

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) Alert.alert("Erro", translateAuthError(error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!supabase) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });
      if (error) {
        Alert.alert("Erro", translateAuthError(error.message));
      } else {
        Alert.alert("Sucesso", "Verifique seu e-mail para ativar a conta.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Image
              source={require("../../assets/images/icon.png")}
              style={styles.logo}
            />
            <Text style={styles.title}>InventExpert</Text>
            <Text style={styles.subtitle}>
              Gestão de Inventário para Líderes
            </Text>
          </View>

          {!isSupabaseConfigured && (
            <Text style={styles.errorText}>
              Atenção: Supabase não configurado no app.json
            </Text>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="exemplo@email.com"
              style={styles.input}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              style={styles.input}
            />
          </View>

          <Pressable
            onPress={handleSignIn}
            style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonTextPrimary}>Entrar</Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleSignUp}
            style={styles.buttonSecondary}
            disabled={loading}
          >
            <Text style={styles.buttonTextSecondary}>Criar nova conta</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              Alert.alert("Recuperação", "Funcionalidade em desenvolvimento.")
            }
            style={styles.buttonGhost}
          >
            <Text style={styles.buttonTextGhost}>Esqueci minha senha</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  container: { flex: 1, justifyContent: "center", padding: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  header: { alignItems: "center", marginBottom: 32 },
  logo: { width: 64, height: 64, borderRadius: 12, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1E40AF" },
  subtitle: { fontSize: 14, color: "#64748B", marginTop: 4 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#1E293B",
    backgroundColor: "#F8FAFC",
  },
  buttonPrimary: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: "#93C5FD" },
  buttonTextPrimary: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: "#2563EB",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  buttonTextSecondary: { color: "#2563EB", fontWeight: "600" },
  buttonGhost: { marginTop: 16, alignItems: "center" },
  buttonTextGhost: { color: "#64748B", fontSize: 13 },
  errorText: {
    color: "#DC2626",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
  },
});
