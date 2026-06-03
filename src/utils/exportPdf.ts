import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform, Alert } from "react-native";
import type {
  InventoryCheckerEvaluation,
  InventoryOperationType,
  SectionAccuracyRecord,
} from "../types";
import {
  generateGerencialReportHtml,
  generateIndividualReportHtml,
  generateEvolucaoReportHtml,
} from "./inventExpReportHtml";

async function sharePdfFromHtml(
  html: string,
  dialogTitle: string,
  fileBaseName: string,
): Promise<void> {
  if (Platform.OS === "web") {
    Alert.alert(
      "PDF no navegador",
      "Exportação PDF está disponível no app mobile. Use o relatório em texto no web.",
    );
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert("PDF gerado", `Arquivo salvo em: ${uri}`);
    return;
  }
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle,
    UTI: "com.adobe.pdf",
  });
}

export async function shareIndividualReportPdf(
  operationType: InventoryOperationType,
  ev: InventoryCheckerEvaluation,
  rank: number,
  totalConferentes: number,
  sectionAccuracy?: SectionAccuracyRecord[],
  dataInventario?: string,
): Promise<void> {
  const html = generateIndividualReportHtml(
    operationType,
    ev,
    rank,
    totalConferentes,
    dataInventario,
    sectionAccuracy,
  );
  await sharePdfFromHtml(
    html,
    `Avaliação — ${ev.input.nome}`,
    `avaliacao_${ev.input.nome.replace(/\s+/g, "_")}`,
  );
}

export async function shareGerencialReportPdf(
  operationType: InventoryOperationType,
  evaluations: InventoryCheckerEvaluation[],
  resumo: {
    totalConferentes: number;
    scoreMedio: number;
    taxaMediaErro: number;
  },
  sectionAccuracy?: SectionAccuracyRecord[],
  dataInventario?: string,
): Promise<void> {
  const html = generateGerencialReportHtml(
    operationType,
    evaluations,
    resumo,
    dataInventario,
    sectionAccuracy,
  );
  await sharePdfFromHtml(
    html,
    "Relatório Gerencial — Avaliação",
    "relatorio_gerencial_avaliacao",
  );
}

export async function shareEvolucaoReportPdf(
  titulo: string,
  corpoTexto: string,
): Promise<void> {
  const html = generateEvolucaoReportHtml(titulo, corpoTexto);
  await sharePdfFromHtml(html, titulo, "evolucao_avaliacao");
}
