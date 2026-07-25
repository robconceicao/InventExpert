import React from "react";
import { Text, View } from "react-native";
import ReportFormShell from "../components/ReportFormShell";
import type { ReportG } from "../types";
import { formatReportG } from "../utils/parsers";

const initialState: ReportG = {
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
  inicioControlados: "",
  inicioDivergencia: "",
  terminoDivergencia: "",
  qtdAlterados: "",
  qtdNaoContados: "",
  qtdEncontradosNaoContados: "",
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

export default function ReportGScreen() {
  return (
    <ReportFormShell
      storageKey="inventexpert:reportG:resumo"
      historyKey="inventexpert:reportG:resumo:history"
      syncKind="reportG"
      initialState={initialState}
      formatPreview={formatReportG}
      reloadOnFocus
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
            {renderTimeField("Ini. Div. Controlados", "inicioControlados")}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTimeField("Ini. Divergência", "inicioDivergencia")}
              </View>
              <View style={styles.half}>
                {renderTimeField("Fim Divergência", "terminoDivergencia")}
              </View>
            </View>
            {renderTextField("Itens Alt. Diverg.", "qtdAlterados", { numeric: true })}
            {renderTextField("Itens Não Cont.", "qtdNaoContados", { numeric: true })}
            {renderTextField("Enc. no Não Cont.", "qtdEncontradosNaoContados", {
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
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Satisfação", "satisfacao", { numeric: true })}
              </View>
              <View style={styles.half}>
                {renderTextField("PH Calculado", "phCalculado", { numeric: true })}
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
