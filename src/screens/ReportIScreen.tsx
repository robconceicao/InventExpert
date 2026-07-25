import React from "react";
import { Text, View } from "react-native";
import ReportFormShell from "../components/ReportFormShell";
import type { ReportI } from "../types";
import { formatReportI } from "../utils/parsers";

const initialState: ReportI = {
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
  inicioNaoContados: "",
  terminoNaoContados: "",
  qtdItensAlterados: "",
  qtdItensNaoContados: "",
  qtdItensEncontradosNaoContados: "",
  envioPrimeiroArquivo: "",
  terminoInventario: "",
  totalPecas: "",
  valorTotal: "",
};

export default function ReportIScreen() {
  return (
    <ReportFormShell
      storageKey="inventexpert:reportI:resumo"
      historyKey="inventexpert:reportI:resumo:history"
      syncKind="reportI"
      initialState={initialState}
      formatPreview={formatReportI}
    >
      {({ renderTextField, renderTimeField, styles }) => (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Identificação</Text>
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Nº Loja", "lojaNum", { numeric: true })}
              </View>
              <View style={styles.half}>{renderTextField("Data", "data")}</View>
            </View>
            {renderTextField("Loja", "lojaNome")}
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
            {renderTimeField("Cheg. Equipe", "chegadaEquipe")}
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
                {renderTimeField("Ini. Divergência", "inicioDivergencia")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Divergência", "terminoDivergencia")}
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Ini. Não Contados", "inicioNaoContados")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Não Contados", "terminoNaoContados")}
              </View>
            </View>
            {renderTextField("Itens Alt.", "qtdItensAlterados", { numeric: true })}
            {renderTextField("Itens Não Cont.", "qtdItensNaoContados", {
              numeric: true,
            })}
            {renderTextField("Enc. no Não Cont.", "qtdItensEncontradosNaoContados", {
              numeric: true,
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Resultado</Text>
            {renderTimeField("Envio 1º Arq.", "envioPrimeiroArquivo")}
            {renderTimeField("Fim Inventário", "terminoInventario")}
            {renderTextField("Total Peças", "totalPecas", { numeric: true })}
            {renderTextField("Valor Total (R$)", "valorTotal", { numeric: true })}
          </View>
        </>
      )}
    </ReportFormShell>
  );
}
