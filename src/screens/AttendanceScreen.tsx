import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AttendanceCollaborator, AttendanceData } from "../types";

const HeaderIcon = require("../../assets/images/splash-icon.png");
const STORAGE_KEY = "inventexpert:attendance";

const initialData: AttendanceData = {
  data: new Date().toLocaleDateString("pt-BR"),
  loja: "",
  enderecoLoja: "",
  colaboradores: [],
};

export default function AttendanceScreen() {
  const [data, setData] = useState<AttendanceData>(initialData);
  const [newName, setNewName] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((res) => {
      if (res) setData(JSON.parse(res));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => null);
  }, [data]);

  const addCollaborator = () => {
    if (!newName.trim()) return;
    const newColab: AttendanceCollaborator = {
      id: Date.now().toString(),
      nome: newName.trim(),
      status: "NAO_DEFINIDO",
    };
    setData((prev) => ({
      ...prev,
      colaboradores: [...prev.colaboradores, newColab],
    }));
    setNewName("");
  };

  const updateStatus = (
    id: string,
    status: AttendanceCollaborator["status"],
  ) => {
    setData((prev) => ({
      ...prev,
      colaboradores: prev.colaboradores.map((c) =>
        c.id === id ? { ...c, status } : c,
      ),
    }));
  };

  const removeCollaborator = (id: string) => {
    setData((prev) => ({
      ...prev,
      colaboradores: prev.colaboradores.filter((c) => c.id !== id),
    }));
  };

  const formatMessage = () => {
    const presentes = data.colaboradores
      .filter((c) => c.status === "PRESENTE")
      .map((c) => c.nome);
    const ausentes = data.colaboradores
      .filter((c) => c.status === "AUSENTE")
      .map((c) => c.nome);

    return `*RELATÓRIO DE ESCALA*

📅 Data: *${data.data}*
🏢 Loja: *${data.loja || "N/A"}*
📍 Endereço: *${data.enderecoLoja || "N/A"}*

👥 *Resumo da Equipe*
Total: ${data.colaboradores.length} | Presentes: ${presentes.length} | Ausentes: ${ausentes.length}

✅ *Presentes:*
${presentes.length > 0 ? presentes.join("\n") : "- Ninguém"}

❌ *Ausentes:*
${ausentes.length > 0 ? ausentes.join("\n") : "- Ninguém"}

📋 *Status Completo:*
${data.colaboradores
  .map((c) => {
    const icon =
      c.status === "PRESENTE" ? "✅" : c.status === "AUSENTE" ? "❌" : "❓";
    return `${icon} ${c.nome}`;
  })
  .join("\n")}`;
  };

  const handleSend = async () => {
    const msg = formatMessage();
    await Clipboard.setStringAsync(msg);
    Alert.alert("Copiado!", "Cole no WhatsApp.", [
      {
        text: "Abrir WhatsApp",
        onPress: () => Linking.openURL("whatsapp://send"),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />
      <View style={styles.header}>
        <Image
          source={HeaderIcon}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>Controle de Escala</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Identificação</Text>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Data</Text>
                <TextInput
                  style={styles.input}
                  value={data.data}
                  onChangeText={(t) =>
                    setData((prev) => ({ ...prev, data: t }))
                  }
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Loja</Text>
                <TextInput
                  style={styles.input}
                  value={data.loja}
                  onChangeText={(t) =>
                    setData((prev) => ({ ...prev, loja: t }))
                  }
                />
              </View>
            </View>
            <Text style={styles.label}>Endereço da Loja</Text>
            <TextInput
              style={styles.input}
              value={data.enderecoLoja}
              onChangeText={(t) =>
                setData((prev) => ({ ...prev, enderecoLoja: t }))
              }
              placeholder="Rua, Número, Bairro..."
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Adicionar Colaborador</Text>
            <View style={styles.addRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginTop: 0 }]}
                value={newName}
                onChangeText={setNewName}
                placeholder="Nome"
                onSubmitEditing={addCollaborator}
              />
              <Pressable style={styles.btnAdd} onPress={addCollaborator}>
                <Ionicons name="add" size={24} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={styles.listContainer}>
            {data.colaboradores.map((colab) => (
              <View key={colab.id} style={styles.colabItem}>
                <View style={styles.colabInfo}>
                  <Text style={styles.colabName}>{colab.nome}</Text>
                  <Pressable onPress={() => removeCollaborator(colab.id)}>
                    <Text style={styles.removeText}>Remover</Text>
                  </Pressable>
                </View>
                <View style={styles.statusButtons}>
                  <Pressable
                    style={[
                      styles.statusBtn,
                      colab.status === "PRESENTE" && styles.presentBtn,
                    ]}
                    onPress={() => updateStatus(colab.id, "PRESENTE")}
                  >
                    <Text
                      style={[
                        styles.statusTxt,
                        colab.status === "PRESENTE" && { color: "#fff" },
                      ]}
                    >
                      P
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.statusBtn,
                      colab.status === "AUSENTE" && styles.absentBtn,
                    ]}
                    onPress={() => updateStatus(colab.id, "AUSENTE")}
                  >
                    <Text
                      style={[
                        styles.statusTxt,
                        colab.status === "AUSENTE" && { color: "#fff" },
                      ]}
                    >
                      F
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {data.colaboradores.length === 0 && (
              <Text style={styles.emptyText}>Lista vazia.</Text>
            )}
          </View>

          <Pressable
            style={styles.buttonPrimary}
            onPress={() => setPreviewVisible(true)}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.btnText}>Gerar Relatório</Text>
          </Pressable>
          <Pressable
            style={styles.buttonClear}
            onPress={() => setData(initialData)}
          >
            <Text style={styles.btnTextDanger}>Limpar Lista</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={previewVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.cardTitle}>Pré-visualização</Text>
            <ScrollView style={styles.previewBox}>
              <Text style={styles.previewText}>{formatMessage()}</Text>
            </ScrollView>
            <View style={styles.row}>
              <Pressable
                style={styles.btnBack}
                onPress={() => setPreviewVisible(false)}
              >
                <Text>Voltar</Text>
              </Pressable>
              <Pressable style={styles.buttonPrimary} onPress={handleSend}>
                <Text style={styles.btnText}>Copiar e Enviar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    padding: 16,
  },
  headerLogo: { width: 32, height: 32, marginRight: 10, borderRadius: 6 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  scrollContent: { padding: 16 },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E40AF",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  label: { fontSize: 12, fontWeight: "600", color: "#64748B", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    fontSize: 16,
    color: "#1E293B",
  },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  addRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  btnAdd: {
    backgroundColor: "#2563EB",
    padding: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 8,
    elevation: 2,
    marginBottom: 16,
  },
  colabItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  colabInfo: { flex: 1 },
  colabName: { fontSize: 16, fontWeight: "600", color: "#1E293B" },
  removeText: { fontSize: 12, color: "#DC2626", marginTop: 4 },
  statusButtons: { flexDirection: "row", gap: 8 },
  statusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  presentBtn: { backgroundColor: "#16A34A" },
  absentBtn: { backgroundColor: "#DC2626" },
  statusTxt: { fontWeight: "bold", color: "#64748B" },
  emptyText: { textAlign: "center", color: "#94A3B8", padding: 20 },
  buttonPrimary: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  buttonClear: { marginTop: 12, padding: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  btnTextDanger: { color: "#DC2626", fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    maxHeight: "80%",
  },
  previewBox: {
    backgroundColor: "#F1F5F9",
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  previewText: { fontSize: 14, color: "#334155" },
  btnBack: {
    flex: 1,
    padding: 14,
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
  },
});
