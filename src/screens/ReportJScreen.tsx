import React from "react";
import { Text, View } from "react-native";
import ReportFormShell from "../components/ReportFormShell";
import type { ReportJ } from "../types";
import { formatReportJ } from "../utils/parsers";

const initialState: ReportJ = {
  lojaNome: "",
  lojaNum: "",
  lider: "",
  qtdColaboradores: "",
  qtdPecas: "",
  pctInventario: "",
  chegada: "",
  inicioControlados: "",
  terminoControlados: "",
  inicioLoja: "",
  terminoLoja: "",
  inicioAuditoria: "",
  terminoAuditoria: "",
  avalEstoque: "",
  avalLoja: "",
  terminoInventario: "",
};

export default function ReportJScreen() {
  return (
    <ReportFormShell
      storageKey="inventexpert:reportJ:resumo"
      historyKey="inventexpert:reportJ:resumo:history"
      syncKind="reportJ"
      initialState={initialState}
      formatPreview={formatReportJ}
    >
      {({ renderTextField, renderTimeField, styles }) => (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Identificação</Text>
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Nº Loja", "lojaNum", { numeric: true })}
              </View>
              <View style={styles.half}>
                {renderTextField("Qtd. Colab.", "qtdColaboradores", {
                  numeric: true,
                })}
              </View>
            </View>
            {renderTextField("Loja", "lojaNome")}
            {renderTextField("Líder", "lider")}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Cronograma</Text>
            {renderTimeField("Cheg. Equipe", "chegada")}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Ini. Controlados", "inicioControlados")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Controlados", "terminoControlados")}
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Ini. Cont. Loja", "inicioLoja")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Cont. Loja", "terminoLoja")}
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Ini. Auditoria", "inicioAuditoria")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Auditoria", "terminoAuditoria")}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Resultado</Text>
            {renderTextField("Qtd. Peças", "qtdPecas", { numeric: true })}
            {renderTextField("% Inventário", "pctInventario", {
              numeric: true,
              placeholder: "%",
            })}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Aval. Est. (%)", "avalEstoque", {
                  numeric: true,
                })}
              </View>
              <View style={styles.half}>
                {renderTextField("Aval. Loja (%)", "avalLoja", {
                  numeric: true,
                })}
              </View>
            </View>
            {renderTimeField("Fim Inventário", "terminoInventario")}
          </View>
        </>
      )}
    </ReportFormShell>
  );
}
