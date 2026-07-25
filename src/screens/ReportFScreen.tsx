import React from "react";
import { Text, View } from "react-native";
import ReportFormShell from "../components/ReportFormShell";
import type { ReportF } from "../types";
import { mapReportFToG } from "../utils/mirrorToReportG";
import { formatReportF } from "../utils/parsers";

const initialState: ReportF = {
  lojaNome: "",
  lojaNum: "",
  lider: "",
  qtdPessoas: "",
  chegadaEquipe: "",
  inicioContagemEstoque: "",
  terminoContagemEstoque: "",
  inicioContagemLoja: "",
  terminoContagemLoja: "",
  inicioAuditoria: "",
  terminoAuditoria: "",
  inicioDivergencia: "",
  terminoDivergencia: "",
  qtdPecas: "",
  valorTotal: "",
  pctInventario: "",
  avalEstoque: "",
  avalLoja: "",
  terminoInventario: "",
};

export default function ReportFScreen() {
  return (
    <ReportFormShell
      storageKey="inventexpert:reportF:assai"
      historyKey="inventexpert:reportF:assai:history"
      syncKind="reportF"
      initialState={initialState}
      formatPreview={formatReportF}
      mirrorToG={mapReportFToG}
      fillingReportId="F"
    >
      {({ renderTextField, renderTimeField, styles }) => (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Identificação</Text>
            {renderTextField("Nome da Loja", "lojaNome")}
            {renderTextField("Número da Loja", "lojaNum", { numeric: true })}
            {renderTextField("Líder", "lider")}
            {renderTextField("Número de Pessoas", "qtdPessoas", { numeric: true })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Cronograma</Text>
            {renderTimeField("Chegada da Equipe", "chegadaEquipe")}
            {renderTimeField("Inicio da Contagem Estoque", "inicioContagemEstoque")}
            {renderTimeField("Termino da Contagem do Estoque", "terminoContagemEstoque")}
            {renderTimeField("Início da Contagem da Loja", "inicioContagemLoja")}
            {renderTimeField("Término da Contagem Loja", "terminoContagemLoja")}
            {renderTimeField("Início da Auditoria", "inicioAuditoria")}
            {renderTimeField("Término da Auditoria", "terminoAuditoria")}
            {renderTimeField("Inicio da Divergência", "inicioDivergencia")}
            {renderTimeField("Termino da Divergência", "terminoDivergencia")}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Resultado</Text>
            {renderTextField("Quantidade de Peças", "qtdPecas", { numeric: true })}
            {renderTextField("Valor Total (R$)", "valorTotal", { numeric: true })}
            {renderTextField("Porcentagem do Inventário", "pctInventario", {
              numeric: true,
              placeholder: "%",
            })}
            <View style={styles.row}>
              <View style={styles.half}>
                {renderTextField("Avaliação Estoque", "avalEstoque", { numeric: true })}
              </View>
              <View style={styles.half}>
                {renderTextField("Avaliação Loja", "avalLoja", { numeric: true })}
              </View>
            </View>
            {renderTimeField("Término do Inventário", "terminoInventario")}
          </View>
        </>
      )}
    </ReportFormShell>
  );
}
