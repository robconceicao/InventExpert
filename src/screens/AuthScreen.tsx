import { Ionicons } from "@expo/vector-icons";
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
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const trimmedEmail = useMemo(() => email.trim(), [email]);

  const translateAuthError = (message: string) => {
    const msg = message.toLowerCase();
    if (msg.includes("email not confirmed"))
      return "E-mail não confirmado. Verifique seu spam.";
    if (msg.includes("invalid login credentials"))
      return "E-mail ou senha inválidos.";
    if (msg.includes("user already registered"))
      return "E-mail já cadastrado. Tente entrar ou recupere a senha.";
    if (msg.includes("rate limit") || msg.includes("too many requests"))
      return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
    if (msg.includes("network error"))
      return "Erro de conexão. Verifique sua internet.";
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

  const validatePassword = (pass: string) => {
    const hasLetter = /[a-zA-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSymbol = /[^a-zA-Z0-9]/.test(pass);
    const isRightLength = pass.length > 0 && pass.length <= 8;
    return hasLetter && hasNumber && hasSymbol && isRightLength;
  };

  const handleSignUp = async () => {
    if (!supabase) return;
    if (!trimmedEmail || !password) {
      return Alert.alert("Aviso", "Preencha todos os campos.");
    }

    if (!validatePassword(password)) {
      setPasswordError(
        "A senha deve ter no máximo 8 caracteres e conter letras, números e símbolos."
      );
      return;
    }
    setPasswordError("");

    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });
      if (error) {
        Alert.alert("Erro", translateAuthError(error.message));
      } else {
        setSuccessMessage(
          "E-mail de confirmação enviado! Verifique sua caixa de entrada (e a pasta de spam) para ativar sua conta."
        );
        // Opcional: Limpar campos
        setPassword("");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!supabase) return;
    if (!trimmedEmail) {
      return Alert.alert("Aviso", "Por favor, digite seu e-mail primeiro para recuperar a senha.");
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
      if (error) {
        Alert.alert("Erro", translateAuthError(error.message));
      } else {
        Alert.alert(
          "Recuperação enviada",
          "Um link para criar uma nova senha foi enviado para seu e-mail."
        );
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

          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsText}>
              <Text style={{ fontWeight: "700" }}>Primeiro acesso?</Text> Digite seu e-mail e uma senha (máx. 8 caracteres, com letras, números e símbolos) e clique em {"\""}Criar nova conta{"\""}. Em seguida, confirme a ativação no seu e-mail.
            </Text>
          </View>

          {!isSupabaseConfigured && (
            <Text style={styles.errorText}>
              Atenção: Supabase não configurado no app.json
            </Text>
          )}
          
          {successMessage ? (
            <View style={styles.successContainer}>
              <Ionicons name="mail-unread-outline" size={24} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={styles.successTitle}>Verifique seu e-mail</Text>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
              <Pressable onPress={() => setSuccessMessage("")}>
                <Ionicons name="close-circle-outline" size={20} color="#059669" />
              </Pressable>
            </View>
          ) : null}

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
            <View style={styles.passwordContainer}>
              <TextInput
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) setPasswordError("");
                }}
                secureTextEntry={!showPassword}
                placeholder="••••••••"
                style={styles.inputPassword}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#64748B"
                />
              </Pressable>
            </View>
            {passwordError ? (
              <Text style={styles.inputErrorText}>{passwordError}</Text>
            ) : null}
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
            onPress={handleResetPassword}
            style={styles.buttonGhost}
            disabled={loading}
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
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
  },
  inputPassword: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: "#1E293B",
  },
  eyeButton: {
    padding: 12,
  },
  inputErrorText: {
    color: "#DC2626",
    fontSize: 11,
    marginTop: 4,
    fontWeight: "500",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
  },
  successContainer: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  successTitle: {
    color: "#065F46",
    fontWeight: "bold",
    fontSize: 14,
    marginBottom: 2,
  },
  successText: {
    color: "#047857",
    fontSize: 13,
    lineHeight: 18,
  },
  instructionsContainer: {
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#3B82F6",
  },
  instructionsText: {
    fontSize: 13,
    color: "#1E40AF",
    lineHeight: 18,
  },
});
