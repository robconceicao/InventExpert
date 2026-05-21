import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FarmacondeData, sendFarmacondeReport } from "../utils/farmacondeReport";

export default function ReportFarmacondeScreen() {
  const [data, setData] = useState<FarmacondeData>({
    lojaCliente: "",
    filialLoja: "",
    lider: "",
    qtdEquipe: "",
    qtdFaltas: "",
    inicioContagem: "",
    fimContagem: "",
    percentualInventario: "",
    naoContadosInicio: "",
    naoContadosTotal: "",
    naoContadosFim: "",
    div1Inicio: "",
    div1Controlados: "",
    div1Negativos: "",
    div1Positivos: "",
    div1Total: "",
    div1Fim: "",
    div2Inicio: "",
    div2Negativos: "",
    div2Positivos: "",
    div2Total: "",
    div2Fim: "",
  });

  const handleChange = (field: keyof FarmacondeData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSend = () => {
    // Validate if all fields are filled
    const emptyFields = Object.keys(data).filter((k) => !data[k as keyof FarmacondeData]);
    if (emptyFields.length > 0) {
      Alert.alert("Atenção", "Por favor, preencha todos os campos antes de enviar o relatório.");
      return;
    }
    
    sendFarmacondeReport(data);
  };

  const InputField = ({ label, field, placeholder = "" }: { label: string; field: keyof FarmacondeData; placeholder?: string }) => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={data[field]}
        onChangeText={(val) => handleChange(field, val)}
        placeholder={placeholder || label}
        placeholderTextColor="rgba(255,255,255,0.4)"
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.container, { backgroundColor: "#1E293B" }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <View style={styles.glassCard}>
            <View style={styles.headerRow}>
              <Ionicons name="medkit" size={24} color="#10B981" />
              <Text style={styles.sectionTitle}>INVENTÁRIO</Text>
            </View>
            <InputField label="Loja/Cliente" field="lojaCliente" />
            <InputField label="Filial da loja" field="filialLoja" />
            <InputField label="Líder" field="lider" />
            <InputField label="Quantidade Equipe" field="qtdEquipe" placeholder="Ex: 5" />
            <InputField label="Quantidade de faltas" field="qtdFaltas" placeholder="Ex: 0" />
          </View>

          <View style={styles.glassCard}>
            <View style={styles.headerRow}>
              <Ionicons name="map" size={24} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Mapeamento</Text>
            </View>
            <InputField label="Início Contagem (Geral)" field="inicioContagem" placeholder="Ex: 08:00" />
            <InputField label="Fim Contagem (Geral)" field="fimContagem" placeholder="Ex: 12:00" />
            <InputField label="% do Inventário" field="percentualInventario" placeholder="Ex: 100%" />
          </View>

          <View style={styles.glassCard}>
            <View style={styles.headerRow}>
              <Ionicons name="close-circle" size={24} color="#EF4444" />
              <Text style={styles.sectionTitle}>Não Contados</Text>
            </View>
            <InputField label="Início (zerados)" field="naoContadosInicio" placeholder="Ex: 12:10" />
            <InputField label="Total de Itens" field="naoContadosTotal" />
            <InputField label="Fim (zerados)" field="naoContadosFim" placeholder="Ex: 12:30" />
          </View>

          <View style={styles.glassCard}>
            <View style={styles.headerRow}>
              <Ionicons name="warning" size={24} color="#F59E0B" />
              <Text style={styles.sectionTitle}>1º Divergência</Text>
            </View>
            <InputField label="Início da divergência" field="div1Inicio" placeholder="Ex: 13:00" />
            <InputField label="Itens Controlados" field="div1Controlados" />
            <InputField label="Itens Negativos (perdas)" field="div1Negativos" />
            <InputField label="Itens Positivos (sobras)" field="div1Positivos" />
            <InputField label="Total de Itens" field="div1Total" />
            <InputField label="Fim da divergência" field="div1Fim" placeholder="Ex: 14:00" />
          </View>

          <View style={styles.glassCard}>
            <View style={styles.headerRow}>
              <Ionicons name="warning" size={24} color="#F59E0B" />
              <Text style={styles.sectionTitle}>2º Divergência</Text>
            </View>
            <InputField label="Início da divergência" field="div2Inicio" placeholder="Ex: 14:30" />
            <InputField label="Itens Negativos (perdas)" field="div2Negativos" />
            <InputField label="Itens Positivos (sobras)" field="div2Positivos" />
            <InputField label="Total de Itens" field="div2Total" />
            <InputField label="Fim da divergência" field="div2Fim" placeholder="Ex: 15:30" />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleSend}>
            <Ionicons name="logo-whatsapp" size={24} color="#fff" />
            <Text style={styles.buttonText}>Enviar por WhatsApp</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  glassCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    marginBottom: 6,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  button: {
    backgroundColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
});
