import { useCallback } from "react";
import { Alert, Linking, Platform } from "react-native";

import type {
  InventoryCheckerEvaluation,
  InventoryOperationType,
  ModalidadeContrato,
  SectionAccuracyRecord,
} from "../../types";
import { shareCsvFile, shareTextFile } from "../../utils/export";
import {
  shareGerencialReportPdf,
  shareIndividualReportPdf,
} from "../../utils/exportPdf";
import {
  generateInventExpGerencialReportText,
  generateInventExpIndividualReportText,
  generateInventExpWhatsAppShort,
} from "../../utils/inventExpReports";

type Resumo = {
  totalConferentes: number;
  totalItens: number;
  taxaMediaErro: number;
  produtividadeMedia: number;
  scoreMedio: number;
};

export function useInventExpExport(
  evaluations: InventoryCheckerEvaluation[],
  operationType: InventoryOperationType,
  resumo: Resumo | null,
  sectionAccuracy: SectionAccuracyRecord[],
  isExtendedTags: boolean,
  getModalidade: (nome: string) => ModalidadeContrato,
) {
  const evComModalidade = useCallback(
    (ev: InventoryCheckerEvaluation): InventoryCheckerEvaluation => ({
      ...ev,
      input: {
        ...ev.input,
        modalidadeContrato: getModalidade(ev.input.nome),
      },
    }),
    [getModalidade],
  );

  const handleExportCsv = useCallback(async () => {
    if (evaluations.length === 0) {
      Alert.alert("Sem dados", "Processe os dados primeiro.");
      return;
    }
    const headers = [
      "Rank",
      "Operacao",
      "Nome",
      "Qtde",
      "Qtde1a1",
      "Produtividade_itens_h",
      "Erro",
      "Pct_Erro_%",
      "Pct_Bloco_%",
      "Score_Qualidade",
      "Score_Produtividade",
      "Score_Aderencia",
      "Score_Final",
      "Nivel",
      "Tags",
    ];
    const rows = evaluations.map((e, i) => [
      i + 1,
      e.operationType,
      e.input.nome,
      e.input.qtde,
      e.input.qtde1a1,
      e.input.produtividade,
      e.input.erro,
      e.pctErro.toFixed(2),
      e.pctBloco.toFixed(2),
      Math.round(e.scoreQualidade),
      Math.round(e.scoreProdutividade),
      Math.round(e.scoreAderencia),
      e.scoreFinal,
      e.nivel,
      e.tags.join(" | "),
    ]);
    await shareCsvFile(
      `resultado_avaliacao_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
    );
  }, [evaluations]);

  const handleExportGerencial = useCallback(async () => {
    if (!resumo || evaluations.length === 0) {
      Alert.alert("Sem dados", "Processe os dados primeiro.");
      return;
    }
    const text = generateInventExpGerencialReportText(
      operationType,
      evaluations,
      resumo,
      undefined,
      isExtendedTags ? sectionAccuracy : undefined,
    );
    await shareTextFile(
      `relatorio_gerencial_avaliacao_${new Date().toISOString().slice(0, 10)}.txt`,
      text,
      "Exportar Relatório Gerencial Avaliação",
    );
  }, [evaluations, operationType, resumo, sectionAccuracy, isExtendedTags]);

  const handleExportGerencialPdf = useCallback(async () => {
    if (!resumo || evaluations.length === 0) {
      Alert.alert("Sem dados", "Processe os dados primeiro.");
      return;
    }
    try {
      await shareGerencialReportPdf(
        operationType,
        evaluations,
        {
          totalConferentes: resumo.totalConferentes,
          scoreMedio: resumo.scoreMedio,
          taxaMediaErro: resumo.taxaMediaErro,
        },
        isExtendedTags ? sectionAccuracy : undefined,
      );
    } catch {
      Alert.alert("Erro", "Não foi possível gerar o PDF gerencial.");
    }
  }, [evaluations, operationType, resumo, sectionAccuracy, isExtendedTags]);

  const openWhatsApp = useCallback((text: string) => {
    const waUrl =
      Platform.OS === "web"
        ? `https://wa.me/?text=${encodeURIComponent(text)}`
        : `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(waUrl).catch(() =>
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp neste dispositivo."),
    );
  }, []);

  const handleSendIndividualWhatsApp = useCallback(
    (ev: InventoryCheckerEvaluation, index: number, short = false) => {
      const evM = evComModalidade(ev);
      const text = short
        ? generateInventExpWhatsAppShort(
            operationType,
            evM,
            index + 1,
            evaluations.length,
            undefined,
            isExtendedTags ? sectionAccuracy : undefined,
          )
        : generateInventExpIndividualReportText(
            operationType,
            evM,
            index + 1,
            evaluations.length,
            undefined,
            isExtendedTags ? sectionAccuracy : undefined,
          );
      openWhatsApp(text);
    },
    [evComModalidade, evaluations.length, operationType, sectionAccuracy, isExtendedTags, openWhatsApp],
  );

  const handleSendIndividualPdf = useCallback(
    async (ev: InventoryCheckerEvaluation, index: number) => {
      try {
        await shareIndividualReportPdf(
          operationType,
          evComModalidade(ev),
          index + 1,
          evaluations.length,
          isExtendedTags ? sectionAccuracy : undefined,
        );
      } catch {
        Alert.alert("Erro", "Não foi possível gerar o PDF individual.");
      }
    },
    [evComModalidade, evaluations.length, operationType, sectionAccuracy, isExtendedTags],
  );

  const showIndividualReportOptions = useCallback(
    (ev: InventoryCheckerEvaluation, index: number) => {
      Alert.alert(
        `Relatório — ${ev.input.nome}`,
        "Escolha o formato de envio:",
        [
          {
            text: "WhatsApp (texto completo)",
            onPress: () => handleSendIndividualWhatsApp(ev, index, false),
          },
          {
            text: "WhatsApp (resumo)",
            onPress: () => handleSendIndividualWhatsApp(ev, index, true),
          },
          {
            text: "Exportar PDF",
            onPress: () => void handleSendIndividualPdf(ev, index),
          },
          { text: "Cancelar", style: "cancel" },
        ],
      );
    },
    [handleSendIndividualPdf, handleSendIndividualWhatsApp],
  );

  const handleSendAllWhatsApp = useCallback(() => {
    if (evaluations.length === 0) return;
    const nomes = evaluations.map((e) => e.input.nome).join("\n• ");
    Alert.alert(
      "Enviar para todos",
      `Serão abertos ${evaluations.length} diálogos do WhatsApp, um por conferente:\n\n• ${nomes}\n\nContinuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          onPress: () => {
            evaluations.forEach((ev, i) => {
              setTimeout(() => handleSendIndividualWhatsApp(ev, i, true), i * 800);
            });
          },
        },
      ],
    );
  }, [evaluations, handleSendIndividualWhatsApp]);

  return {
    handleExportCsv,
    handleExportGerencial,
    handleExportGerencialPdf,
    showIndividualReportOptions,
    handleSendAllWhatsApp,
  };
}
