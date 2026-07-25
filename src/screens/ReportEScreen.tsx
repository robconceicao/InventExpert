import React from "react";
import { Text, View } from "react-native";
import ReportFormShell from "../components/ReportFormShell";
import type { ReportE } from "../types";
import { mapReportEToG } from "../utils/mirrorToReportG";
import { formatReportE } from "../utils/parsers";

const initialState: ReportE = {
  lojaNum: "",
  lojaNome: "",
  data: new Date().toLocaleDateString("pt-BR"),
  responsavel: "",
  qtdPessoas: "",
  chegadaEquipe: "",
  inicioDeposito: "",
  terminoDeposito: "",
  inicioLoja: "",
  terminoLoja: "",
  inicioAuditoriaCliente: "",
  terminoAuditoriaCliente: "",
  inicioDivergencia: "",
  terminoDivergencia: "",
  totalPecas: "",
  valorTotal: "",
  pctInv: "",
  avalEstoque: "",
  avalLoja: "",
  terminoInventario: "",
};

export default function ReportEScreen() {
  return (
    <ReportFormShell
      storageKey="inventexpert:reportE:outros"
      historyKey="inventexpert:reportE:outros:history"
      syncKind="reportE"
      initialState={initialState}
      formatPreview={formatReportE}
      mirrorToG={mapReportEToG}
      fillingReportId="E"
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
            {renderTextField("Responsável", "responsavel")}
            {renderTextField("Qtd. Pessoas", "qtdPessoas", { numeric: true })}
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
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Resultado</Text>
            {renderTextField("Total Peças", "totalPecas", { numeric: true })}
            {renderTextField("Valor Total (R$)", "valorTotal", { numeric: true })}
            {renderTextField("% Inv.", "pctInv", { numeric: true, placeholder: "%" })}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Aval. Est. (%)", "avalEstoque", { numeric: true })}
              </View>
              <View style={styles.half}>
                {renderTextField("Aval. Loja (%)", "avalLoja", { numeric: true })}
              </View>
            </View>
            {renderTimeField("Fim Inventário", "terminoInventario")}
          </View>
        </>
      )}
    </ReportFormShell>
  );
}
