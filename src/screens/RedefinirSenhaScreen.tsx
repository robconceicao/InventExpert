import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../services/supabase";
import {
  translateAuthError,
  translateThrownAuthError,
} from "../utils/authErrorMessage";
import {
  REGRA_DE_SENHA,
  mensagemDeSenha,
  validarSenha,
} from "../utils/passwordPolicy";
import { mensagemDeLinkInvalido, type RecoveryLink } from "../utils/recoveryLink";

type Props = {
  link: Exclude<RecoveryLink, { tipo: "ausente" }>;
  /** Chamado quando não há mais nada a fazer aqui — devolve o app ao login. */
  onConcluir: () => void;
};

/** Onde estamos no caminho: cada estado mostra uma coisa só. */
type Etapa = "abrindo" | "formulario" | "salvando" | "pronto" | "invalido";

export default function RedefinirSenhaScreen({ link, onConcluir }: Props) {
  const [etapa, setEtapa] = useState<Etapa>(
    link.tipo === "erro" ? "invalido" : "abrindo",
  );
  const [erro, setErro] = useState(
    link.tipo === "erro" ? mensagemDeLinkInvalido(link) : "",
  );
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // O token de recuperação vale como sessão: é ele que autoriza o updateUser.
  // Enquanto não for aceito, não faz sentido mostrar formulário.
  useEffect(() => {
    if (link.tipo !== "recuperacao") return;
    let vivo = true;

    (async () => {
      if (!supabase) {
        if (vivo) {
          setErro("Supabase não configurado.");
          setEtapa("invalido");
        }
        return;
      }
      try {
        const { error } = await supabase.auth.setSession({
          access_token: link.accessToken,
          refresh_token: link.refreshToken,
        });
        if (!vivo) return;
        if (error) {
          setErro(translateAuthError(error.message));
          setEtapa("invalido");
        } else {
          setEtapa("formulario");
        }
      } catch (e) {
        if (!vivo) return;
        setErro(translateThrownAuthError(e));
        setEtapa("invalido");
      }
    })();

    return () => {
      vivo = false;
    };
  }, [link]);

  const handleSalvar = async () => {
    if (!supabase) return;

    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }
    const falha = validarSenha(senha);
    if (falha) {
      setErro(mensagemDeSenha(falha));
      return;
    }
    setErro("");

    try {
      setEtapa("salvando");
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        setErro(translateAuthError(error.message));
        setEtapa("formulario");
        return;
      }
      // A sessão veio do link, não de alguém que digitou a senha. Deixá-la viva
      // faria o app entrar sozinho, e a pessoa sairia sem saber se anotou a
      // senha nova.
      await supabase.auth.signOut();
      setEtapa("pronto");
    } catch (e) {
      setErro(translateThrownAuthError(e));
      setEtapa("formulario");
    }
  };

  const abrirApp = () => {
    void Linking.openURL("inventexpert://").catch(() => {
      // Sem o app instalado não há o que abrir; a instrução ao lado resolve.
    });
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
            <Text style={styles.subtitle}>Criar uma nova senha</Text>
          </View>

          {etapa === "abrindo" && (
            <View style={styles.centro}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.ajuda}>Conferindo o link…</Text>
            </View>
          )}

          {etapa === "invalido" && (
            <View>
              <View style={styles.aviso}>
                <Ionicons name="alert-circle-outline" size={22} color="#B91C1C" />
                <Text style={styles.avisoTexto}>{erro}</Text>
              </View>
              <Pressable style={styles.botao} onPress={onConcluir}>
                <Text style={styles.botaoTexto}>Voltar para o login</Text>
              </Pressable>
            </View>
          )}

          {etapa === "pronto" && (
            <View>
              <View style={styles.sucesso}>
                <Ionicons name="checkmark-circle-outline" size={22} color="#059669" />
                <Text style={styles.sucessoTexto}>
                  Senha alterada. Use a senha nova para entrar.
                </Text>
              </View>
              <Pressable style={styles.botao} onPress={abrirApp}>
                <Text style={styles.botaoTexto}>Abrir o InventExpert</Text>
              </Pressable>
              <Text style={styles.ajuda}>
                Se o app não abrir sozinho, abra o InventExpert no seu celular e
                entre com a senha nova.
              </Text>
              <Pressable onPress={onConcluir}>
                <Text style={styles.link}>Continuar aqui mesmo</Text>
              </Pressable>
            </View>
          )}

          {(etapa === "formulario" || etapa === "salvando") && (
            <View>
              <Text style={styles.ajuda}>{REGRA_DE_SENHA}</Text>

              <View style={styles.grupo}>
                <Text style={styles.rotulo}>Nova senha</Text>
                <View style={styles.campoSenha}>
                  <TextInput
                    value={senha}
                    onChangeText={(t) => {
                      setSenha(t);
                      if (erro) setErro("");
                    }}
                    secureTextEntry={!mostrarSenha}
                    placeholder="••••••••"
                    style={styles.entradaSenha}
                    autoCapitalize="none"
                  />
                  <Pressable
                    onPress={() => setMostrarSenha(!mostrarSenha)}
                    style={styles.olho}
                  >
                    <Ionicons
                      name={mostrarSenha ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color="#64748B"
                    />
                  </Pressable>
                </View>
              </View>

              <View style={styles.grupo}>
                <Text style={styles.rotulo}>Confirmar nova senha</Text>
                <TextInput
                  value={confirmacao}
                  onChangeText={(t) => {
                    setConfirmacao(t);
                    if (erro) setErro("");
                  }}
                  secureTextEntry={!mostrarSenha}
                  placeholder="••••••••"
                  style={styles.entrada}
                  autoCapitalize="none"
                />
              </View>

              {erro ? <Text style={styles.erro}>{erro}</Text> : null}

              <Pressable
                style={[styles.botao, etapa === "salvando" && styles.botaoInativo]}
                onPress={handleSalvar}
                disabled={etapa === "salvando"}
              >
                {etapa === "salvando" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.botaoTexto}>Salvar nova senha</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#E2E8F0" },
  container: { flex: 1, justifyContent: "center", padding: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  header: { alignItems: "center", marginBottom: 20 },
  logo: { width: 72, height: 72, borderRadius: 16, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: "800", color: "#1E3A8A" },
  subtitle: { fontSize: 14, color: "#475569", marginTop: 4 },
  centro: { alignItems: "center", paddingVertical: 24, gap: 12 },
  grupo: { marginBottom: 14 },
  rotulo: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 },
  entrada: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0F172A",
  },
  campoSenha: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
  },
  entradaSenha: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0F172A",
  },
  olho: { paddingHorizontal: 12, paddingVertical: 10 },
  botao: {
    backgroundColor: "#1E3A8A",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  botaoInativo: { opacity: 0.7 },
  botaoTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
  ajuda: { fontSize: 13, color: "#475569", marginTop: 10, lineHeight: 19 },
  link: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 14,
  },
  erro: { color: "#B91C1C", fontSize: 13, marginBottom: 8 },
  aviso: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  avisoTexto: { flex: 1, color: "#7F1D1D", fontSize: 14, lineHeight: 20 },
  sucesso: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  sucessoTexto: { flex: 1, color: "#065F46", fontSize: 14, lineHeight: 20 },
});
