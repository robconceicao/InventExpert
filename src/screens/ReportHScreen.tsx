import React from "react";
import { Text, View } from "react-native";
import ReportFormShell from "../components/ReportFormShell";
import type { ReportH } from "../types";
import { formatReportH } from "../utils/parsers";

const initialState: ReportH = {
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
  envioArquivo: "",
  terminoInventario: "",
  totalPecas: "",
  valorTotal: "",
  avalPrepDeposito: "",
  avalPrepLoja: "",
  responsavelInventario: "",
  satisfacao: "",
  acuracidadeCliente: "",
  acuracidadeTerceirizada: "",
  suporteSolicitado: null,
};

export default function ReportHScreen() {
  return (
    <ReportFormShell
      storageKey="inventexpert:reportH:resumo"
      historyKey="inventexpert:reportH:resumo:history"
      syncKind="reportH"
      initialState={initialState}
      formatPreview={formatReportH}
    >
      {({ renderTextField, renderTimeField, renderBoolField, styles }) => (
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
            {renderTimeField("Envio Arquivo", "envioArquivo")}
            {renderTimeField("Fim Inventário", "terminoInventario")}
            {renderTextField("Total Peças", "totalPecas", { numeric: true })}
            {renderTextField("Valor Total (R$)", "valorTotal", { numeric: true })}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Aval. Prep. Dep.", "avalPrepDeposito", {
                  numeric: true,
                })}
              </View>
              <View style={styles.half}>
                {renderTextField("Aval. Prep. Loja", "avalPrepLoja", {
                  numeric: true,
                })}
              </View>
            </View>
            {renderTextField("Resp. Inventário", "responsavelInventario")}
            {renderTextField("Satisfação", "satisfacao", { numeric: true })}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Acurac. Cliente", "acuracidadeCliente", {
                  numeric: true,
                })}
              </View>
              <View style={styles.half}>
                {renderTextField("Acurac. Terc.", "acuracidadeTerceirizada", {
                  numeric: true,
                })}
              </View>
            </View>
            {renderBoolField("Solic. Suporte?", "suporteSolicitado")}
          </View>
        </>
      )}
    </ReportFormShell>
  );
}
