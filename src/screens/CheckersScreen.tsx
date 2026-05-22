import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getAllCheckersProgress,
  removeCheckerFromDB,
  saveCheckerToDB,
} from "../services/CheckerDBService";
import type { CheckerExperienceLevel } from "../types";

export default function CheckersScreen() {
  const [checkers, setCheckers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingChecker, setEditingChecker] = useState<any>(null);
  const [newLevel, setNewLevel] = useState<CheckerExperienceLevel>("pleno");
  const [newName, setNewName] = useState("");

  const loadData = async () => {
    const data = await getAllCheckersProgress();
    setCheckers(data);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleOpenEdit = (checker: any) => {
    setEditingChecker(checker);
    setNewName(checker.nome);
    setNewLevel(checker.nivel);
    setModalVisible(true);
  };

  const handleOpenNew = () => {
    setEditingChecker(null);
    setNewName("");
    setNewLevel("pleno");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!newName.trim()) {
      Alert.alert("Erro", "Nome é obrigatório.");
      return;
    }
    await saveCheckerToDB(newName.trim(), newLevel);
    setModalVisible(false);
    await loadData();
  };

  const handleDelete = async () => {
    if (!editingChecker || !editingChecker.registrado) return;
    Alert.alert(
      "Remover do Banco",
      `Deseja remover ${editingChecker.nome} do banco base? O histórico de presença continuará existindo.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            await removeCheckerFromDB(editingChecker.nome);
            setModalVisible(false);
            await loadData();
          },
        },
      ]
    );
  };

  const filtered = checkers.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Base de Conferentes</Text>
      </View>

      <View style={styles.container}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar conferente..."
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <Pressable onPress={handleOpenNew} style={styles.btnAdd}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.btnTextWhite}>Novo</Text>
          </Pressable>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Como funciona a experiência?</Text>
          <Text style={styles.statsText}>
            • <Text style={{fontWeight:"bold"}}>Novato</Text> (0-2)
            • <Text style={{fontWeight:"bold"}}>Junior</Text> (3-10)
            • <Text style={{fontWeight:"bold"}}>Pleno</Text> (11-30)
            • <Text style={{fontWeight:"bold"}}>Senior</Text> (31-50)
            • <Text style={{fontWeight:"bold"}}>Expert</Text> (51+)
          </Text>
          <Text style={styles.statsText}>
            O nível é calculado somando a bagagem que você cadastra manualmente com as presenças confirmadas no aplicativo.
          </Text>
        </View>

        <ScrollView style={styles.list}>
          {filtered.map((c, i) => (
            <Pressable
              key={i}
              style={styles.checkerCard}
              onPress={() => handleOpenEdit(c)}
            >
              <View style={styles.checkerInfo}>
                <Text style={styles.checkerName}>{c.nome}</Text>
                <Text style={styles.checkerMeta}>
                  Base: {c.base} | Presenças app: {c.presencas} | Total: {c.total} lojas
                </Text>
              </View>
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>{c.nivel.toUpperCase()}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </Pressable>
          ))}
          {filtered.length === 0 && (
            <Text style={styles.emptyText}>Nenhum conferente encontrado.</Text>
          )}
        </ScrollView>
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingChecker ? "Editar Conferente" : "Cadastrar Veterano"}
            </Text>

            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              editable={!editingChecker || !editingChecker.registrado} // se ja esta registrado no db, edita normal. se só veio da presenca, vira novo registro
            />

            <Text style={styles.label}>Nível Base (Bagagem anterior)</Text>
            <View style={styles.levelGrid}>
              {(["novato", "junior", "pleno", "senior", "expert"] as CheckerExperienceLevel[]).map(
                (lvl) => (
                  <Pressable
                    key={lvl}
                    onPress={() => setNewLevel(lvl)}
                    style={[
                      styles.levelOption,
                      newLevel === lvl && styles.levelOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.levelOptionText,
                        newLevel === lvl && styles.levelOptionTextActive,
                      ]}
                    >
                      {lvl}
                    </Text>
                  </Pressable>
                )
              )}
            </View>

            <View style={styles.modalActions}>
              {editingChecker && editingChecker.registrado && (
                <Pressable onPress={handleDelete} style={styles.btnDelete}>
                  <Ionicons name="trash" size={20} color="#dc2626" />
                </Pressable>
              )}
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.btnCancel}
              >
                <Text style={styles.btnTextSecondary}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleSave} style={styles.btnSave}>
                <Text style={styles.btnTextWhite}>Salvar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    backgroundColor: "#1d4ed8",
    padding: 16,
    paddingTop: 12,
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  container: { padding: 16, flex: 1 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, marginLeft: 8, height: 44 },
  btnAdd: {
    backgroundColor: "#16a34a",
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  btnTextWhite: { color: "#fff", fontWeight: "600" },
  statsCard: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statsTitle: { color: "#fff", fontWeight: "600", marginBottom: 8 },
  statsText: { color: "#94a3b8", fontSize: 13, lineHeight: 20 },
  list: { flex: 1 },
  checkerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  checkerInfo: { flex: 1 },
  checkerName: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  checkerMeta: { fontSize: 12, color: "#64748b", marginTop: 4 },
  levelBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  levelText: { fontSize: 11, fontWeight: "700", color: "#1d4ed8" },
  emptyText: { color: "#94a3b8", textAlign: "center", marginTop: 32 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 16,
  },
  label: { fontSize: 14, fontWeight: "600", color: "#334155", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  levelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  levelOption: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  levelOptionActive: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  levelOptionText: { color: "#475569", fontWeight: "500", textTransform: "capitalize" },
  levelOptionTextActive: { color: "#fff" },
  modalActions: { flexDirection: "row", gap: 8 },
  btnDelete: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  btnCancel: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
  },
  btnTextSecondary: { color: "#475569", fontWeight: "600" },
  btnSave: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
  },
});
