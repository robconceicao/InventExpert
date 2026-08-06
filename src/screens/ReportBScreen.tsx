import React from "react";
import { Text, View } from "react-native";
import ReportFormShell from "../components/ReportFormShell";
import type { ReportB } from "../types";
import { mapReportBToG } from "../utils/mirrorToReportG";
import { formatReportB } from "../utils/parsers";

const initialState: ReportB = {
  cliente: "FARMACONDE",
  filial: "",
  lider: "",
  qtdEquipe: "",
  qtdFaltas: "",
  inicioContagemGeral: "",
  fimContagemGeral: "",
  pctInventario: "",
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
};

export default function ReportBScreen() {
  return (
    <ReportFormShell
      storageKey="inventexpert:reportB:farmaconde"
      historyKey="inventexpert:reportB:farmaconde:history"
      syncKind="reportB"
      initialState={initialState}
      formatPreview={formatReportB}
      mirrorToG={mapReportBToG}
      fillingReportId="B"
    >
      {({ renderTextField, renderTimeField, styles }) => (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Inventário</Text>
            {renderTextField("Loja/Cliente", "cliente")}
            {renderTextField("Filial da loja", "filial")}
            {renderTextField("Líder", "lider")}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Quantidade Equipe", "qtdEquipe", { numeric: true })}
              </View>
              <View style={styles.half}>
                {renderTextField("Quantidade de faltas", "qtdFaltas", { numeric: true })}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Mapeamento</Text>
            {renderTimeField("Início Contagem (Geral)", "inicioContagemGeral")}
            {renderTimeField("Fim Contagem (Geral)", "fimContagemGeral")}
            {renderTextField("% do Inventário", "pctInventario", {
              numeric: true,
              placeholder: "%",
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Não Contados</Text>
            {renderTimeField("Início (zerados)", "naoContadosInicio")}
            {renderTextField("Total de Itens", "naoContadosTotal", { numeric: true })}
            {renderTimeField("Fim (zerados)", "naoContadosFim")}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. 1º Divergência</Text>
            {renderTimeField("Início da divergência", "div1Inicio")}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Itens Controlados", "div1Controlados", { numeric: true })}
              </View>
              <View style={styles.half}>
                {renderTextField("Negativos (perdas)", "div1Negativos", { numeric: true })}
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Positivos (sobras)", "div1Positivos", { numeric: true })}
              </View>
              <View style={styles.half}>
                {renderTextField("Total de Itens", "div1Total", { numeric: true })}
              </View>
            </View>
            {renderTimeField("Fim da divergência", "div1Fim")}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. 2º Divergência</Text>
            {renderTimeField("Início da divergência", "div2Inicio")}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Negativos (perdas)", "div2Negativos", { numeric: true })}
              </View>
              <View style={styles.half}>
                {renderTextField("Positivos (sobras)", "div2Positivos", { numeric: true })}
              </View>
            </View>
            {renderTextField("Total de Itens", "div2Total", { numeric: true })}
            {renderTimeField("Fim da divergência", "div2Fim")}
          </View>
        </>
      )}
    </ReportFormShell>
  );
}
