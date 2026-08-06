import React from "react";
import { Text, View } from "react-native";
import ReportFormShell from "../components/ReportFormShell";
import type { ReportD } from "../types";
import { mapReportDToG } from "../utils/mirrorToReportG";
import { formatReportD } from "../utils/parsers";

const initialState: ReportD = {
  lojaNome: "",
  lojaNum: "",
  data: new Date().toLocaleDateString("pt-BR"),
  pivProgramado: "",
  pivRealizado: "",
  chegadaEquipe: "",
  inicioDeposito: "",
  terminoDeposito: "",
  inicioLoja: "",
  terminoLoja: "",
  inicioAuditoriaCliente: "",
  terminoAuditoriaCliente: "",
  inicioDivergencia: "",
  terminoDivergencia: "",
  qtdAlterados: "",
  inicioNaoContados: "",
  qtdNaoContados: "",
  qtdEncontradosNaoContados: "",
  terminoNaoContados: "",
  totalPecas: "",
  valorTotal: "",
  avalPrepDeposito: "",
  avalPrepLoja: "",
  satisfacao: "",
  responsavel: "",
  acuracidadeCliente: "",
  acuracidadeTerceirizada: "",
  suporteSolicitado: null,
  terminoInventario: "",
};

export default function ReportDScreen() {
  return (
    <ReportFormShell
      storageKey="inventexpert:reportD:mercados"
      historyKey="inventexpert:reportD:mercados:history"
      syncKind="reportD"
      initialState={initialState}
      formatPreview={formatReportD}
      mirrorToG={mapReportDToG}
      fillingReportId="D"
    >
      {({ renderTextField, renderTimeField, renderBoolField, styles }) => (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Identificação</Text>
            {renderTextField("Loja", "lojaNome")}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Nº Loja", "lojaNum", { numeric: true })}
              </View>
              <View style={styles.half}>{renderTextField("Data", "data")}</View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("PIV Prog.", "pivProgramado", { numeric: true })}
              </View>
              <View style={styles.half}>
                {renderTextField("PIV Real.", "pivRealizado", { numeric: true })}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Cronograma</Text>
            {renderTimeField("Chegada Equipe", "chegadaEquipe")}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Ini. Cont. Dep.", "inicioDeposito")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Cont. Dep.", "terminoDeposito")}
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
                {renderTimeField("Ini. Audit. Cli.", "inicioAuditoriaCliente")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Audit. Cli.", "terminoAuditoriaCliente")}
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Ini. Diverg.", "inicioDivergencia")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Diverg.", "terminoDivergencia")}
              </View>
            </View>
            {renderTextField("Itens Alt. Diverg.", "qtdAlterados", { numeric: true })}
            {renderTimeField("Ini. N. Cont.", "inicioNaoContados")}
            {renderTextField("Itens N. Cont.", "qtdNaoContados", { numeric: true })}
            {renderTextField("Enc. no N. Cont.", "qtdEncontradosNaoContados", {
              numeric: true,
            })}
            {renderTimeField("Fim N. Cont.", "terminoNaoContados")}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Resultado</Text>
            {renderTextField("Total Peças", "totalPecas", { numeric: true })}
            {renderTextField("Valor Total (R$)", "valorTotal", { numeric: true })}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Aval. Prep. Dep.", "avalPrepDeposito", {
                  numeric: true,
                })}
              </View>
              <View style={styles.half}>
                {renderTextField("Aval. Prep. Loja", "avalPrepLoja", { numeric: true })}
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Acur. Cli. (%)", "acuracidadeCliente", {
                  numeric: true,
                })}
              </View>
              <View style={styles.half}>
                {renderTextField("Acur. Terc. (%)", "acuracidadeTerceirizada", {
                  numeric: true,
                })}
              </View>
            </View>
            {renderTextField("Satisfação", "satisfacao", { numeric: true })}
            {renderTextField("Responsável", "responsavel")}
            {renderBoolField("Houve Suporte?", "suporteSolicitado")}
            {renderTimeField("Fim Inventário", "terminoInventario")}
          </View>
        </>
      )}
    </ReportFormShell>
  );
}
