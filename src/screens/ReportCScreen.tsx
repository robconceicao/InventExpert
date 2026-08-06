import React from "react";
import { Text, View } from "react-native";
import ReportFormShell from "../components/ReportFormShell";
import type { ReportC } from "../types";
import { mapReportCToG } from "../utils/mirrorToReportG";
import { formatReportC } from "../utils/parsers";

const initialState: ReportC = {
  lojaNum: "",
  lojaNome: "",
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
  inicioControlados: "",
  terminoControlados: "",
  inicioDivergencia: "",
  terminoDivergencia: "",
  qtdAlterados: "",
  inicioNaoContados: "",
  terminoNaoContados: "",
  qtdNaoContados: "",
  qtdEncontradosNaoContados: "",
  inicioRecontCliente: "",
  terminoRecontCliente: "",
  qtdItensRecontCliente: "",
  qtdAltRecontCliente: "",
  envioArquivo1: "",
  envioArquivo2: "",
  envioArquivo3: "",
  totalPecas: "",
  valorTotal: "",
  avalPrepDeposito: "",
  avalPrepLoja: "",
  satisfacao: "",
  responsavel: "",
  acuracidadeCliente: "",
  acuracidadeTerceirizada: "",
  suporteSolicitado: null,
  phCalculado: "",
  terminoInventario: "",
};

export default function ReportCScreen() {
  return (
    <ReportFormShell
      storageKey="inventexpert:reportC:farmacias"
      historyKey="inventexpert:reportC:farmacias:history"
      syncKind="reportC"
      initialState={initialState}
      formatPreview={formatReportC}
      mirrorToG={mapReportCToG}
      fillingReportId="C"
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
                {renderTimeField("Ini. Diverg. Ctrl.", "inicioControlados")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Diverg. Ctrl.", "terminoControlados")}
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
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Ini. N. Cont.", "inicioNaoContados")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim N. Cont.", "terminoNaoContados")}
              </View>
            </View>
            {renderTextField("Itens N. Cont.", "qtdNaoContados", { numeric: true })}
            {renderTextField("Enc. no N. Cont.", "qtdEncontradosNaoContados", {
              numeric: true,
            })}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Ini. Recont. Cli.", "inicioRecontCliente")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Recont. Cli.", "terminoRecontCliente")}
              </View>
            </View>
            {renderTextField("Qtd. Itens Recont. Cli.", "qtdItensRecontCliente", {
              numeric: true,
            })}
            {renderTextField("Qtd. Alt. Recont. Cli.", "qtdAltRecontCliente", {
              numeric: true,
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Envio de Arquivos</Text>
            {renderTimeField("Envio 1º Arq.", "envioArquivo1")}
            {renderTimeField("Envio 2º Arq.", "envioArquivo2")}
            {renderTimeField("Envio 3º Arq.", "envioArquivo3")}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Resultado</Text>
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
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Satisfação", "satisfacao", { numeric: true })}
              </View>
              <View style={styles.half}>
                {renderTextField("PH Calc.", "phCalculado", { numeric: true })}
              </View>
            </View>
            {renderTextField("Responsável", "responsavel")}
            {renderBoolField("Houve Suporte?", "suporteSolicitado")}
            {renderTimeField("Fim Inventário", "terminoInventario")}
          </View>
        </>
      )}
    </ReportFormShell>
  );
}
