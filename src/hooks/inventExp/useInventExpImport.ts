import * as DocumentPicker from "expo-document-picker";
import { useMemo, useState } from "react";
import { Alert } from "react-native";

import { salvarHistoricoAvaliacao } from "../../services/AvaliacaoHistoricoService";
import { getCheckerCurrentLevel } from "../../services/CheckerDBService";
import {
  evaluateChecker,
  sortRanking,
} from "../../services/InventoryEvaluationService";
import { getLiderAtual } from "../../services/LiderService";
import type {
  CheckerExperienceLevel,
  InventoryCheckerEvaluation,
  InventoryCheckerInput,
  InventoryOperationType,
  SectionAccuracyRecord,
} from "../../types";
import { readFileAsCsvText } from "../../utils/fileImport";
import { parseDuracaoInput } from "../../utils/inventExpUtils";
import { lookupTagsPorColaborador } from "../../utils/nomeMatching";
import {
  parseInventoryCheckersCsv,
  parseInventoryFull,
  parseTagsExtended,
} from "../../utils/parsers";

const MIN_NAME_LENGTH = 12;

interface ProcessedChecker extends InventoryCheckerInput {
  experiencia: CheckerExperienceLevel;
  itensPulados: number;
  itensDuplicados: number;
  erroSecao: number | undefined;
  numSecoes: number | undefined;
}

function filterCheckersWithoutLeader(
  checkers: ProcessedChecker[],
  leaderName: string | null,
): ProcessedChecker[] {
  if (!leaderName) return checkers;
  const leader = leaderName.toLowerCase().trim();
  return checkers.filter((item) => {
    const checker = item.nome.toLowerCase().trim();
    const minLength = Math.min(leader.length, checker.length, MIN_NAME_LENGTH);
    return (
      !leader.startsWith(checker.slice(0, minLength)) &&
      !checker.startsWith(leader.slice(0, minLength))
    );
  });
}

function handleSectionAccuracyUpdate(
  tagsResult: any,
  porArea: SectionAccuracyRecord[],
  setSectionAccuracy: (value: SectionAccuracyRecord[]) => void,
  setIsExtendedTags: (value: boolean) => void,
) {
  if (tagsResult.isExtended && porArea.length > 0) {
    setSectionAccuracy(tagsResult.porArea);
    setIsExtendedTags(true);
  } else {
    setSectionAccuracy([]);
    setIsExtendedTags(false);
  }
}

export function useInventExpImport() {
  const [operationType, setOperationType] =
    useState<InventoryOperationType>("FARMACIA");
  const [rawText, setRawText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [totalPecas, setTotalPecas] = useState("");
  const [duracaoReal, setDuracaoReal] = useState("");
  const [evaluations, setEvaluations] = useState<InventoryCheckerEvaluation[]>(
    [],
  );
  const [sectionAccuracy, setSectionAccuracy] = useState<
    SectionAccuracyRecord[]
  >([]);
  const [isExtendedTags, setIsExtendedTags] = useState(false);
  const [processing, setProcessing] = useState(false);

  const previewProd = useMemo(() => {
    try {
      const text = rawText.trim();
      if (!text) return null;
      return { count: parseInventoryCheckersCsv(text).length };
    } catch (e) {
      console.warn("parseInventoryCheckersCsv failed", e);
      return null;
    }
  }, [rawText]);

  const previewTags = useMemo(() => {
    try {
      const text = tagsText.trim();
      if (!text) return null;
      const r = parseTagsExtended(text);
      return {
        count: Object.keys(r.porColaborador).length,
        extended: r.isExtended,
      };
    } catch (e) {
      console.warn("parseTagsExtended failed", e);
      return null;
    }
  }, [tagsText]);

  const handlePickFile = async (type: "prod" | "tags") => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/plain",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const text = await readFileAsCsvText(
        file.uri,
        file.mimeType ?? undefined,
      );
      if (type === "prod") setRawText(text);
      else setTagsText(text);
      Alert.alert(
        "Arquivo carregado",
        `${file.name} importado para ${type === "prod" ? "Produtividade" : "Tags"}.`,
      );
    } catch {
      Alert.alert("Erro", "Não foi possível ler o arquivo.");
    }
  };

  const handleProcess = async () => {
    const parsed = parseInventoryCheckersCsv(rawText);
    const tagsResult = parseTagsExtended(tagsText);

    if (parsed.length === 0) {
      Alert.alert(
        "Dados inválidos",
        "Não foi possível ler conferentes. Use o Relatório de Produtividade (CSV/Excel) com colunas como: Nome do Colaborador, Qtde, Horas, Produtividade, Erro (Qtde) — ou o formato simplificado Nome;Qtde;1a1;Produtividade;Erro.",
      );
      return;
    }

    setProcessing(true);
    try {
      const { totalPecasDetectado, duracaoDetectada } =
        parseInventoryFull(rawText);
      if (totalPecasDetectado > 0) setTotalPecas(String(totalPecasDetectado));
      if (duracaoDetectada > 0) setDuracaoReal(duracaoDetectada.toFixed(1));
      const pecas = parseInt(totalPecas.replace(/\D/g, ""), 10) || 0;
      const duracao = parseDuracaoInput(duracaoReal);
      const totalConferentes = parsed.length;

      let nomeDoLider: string | null = null;
      try {
        nomeDoLider = await getLiderAtual();
      } catch {
        // If we cannot fetch the leader, treat as no leader
        nomeDoLider = null;
      }
      const processedCheckers: ProcessedChecker[] = await Promise.all(
        parsed.map(async (item: InventoryCheckerInput) => {
          const exp = await getCheckerCurrentLevel(item.nome).catch(
            (): CheckerExperienceLevel => "pleno",
          );
          const tagsData = lookupTagsPorColaborador(
            tagsResult.porColaborador,
            item.nome,
          ) ?? {
            itensPulados: 0,
            itensDuplicados: 0,
            erroSecao: undefined,
            numSecoes: undefined,
          };
          const qtde = Math.max(0, Number(item.qtde) || 0);
          const qtde1a1 = Math.min(
            Math.max(0, Number(item.qtde1a1) || 0),
            qtde,
          );
          return {
            ...item,
            qtde,
            qtde1a1,
            experiencia: exp,
            itensPulados: tagsData.itensPulados,
            itensDuplicados: tagsData.itensDuplicados,
            erroSecao: tagsResult.isExtended ? tagsData.erroSecao : undefined,
            numSecoes: tagsResult.isExtended ? tagsData.numSecoes : undefined,
          } as ProcessedChecker;
        }),
      );

      const conferentesSemLider = filterCheckersWithoutLeader(processedCheckers, nomeDoLider);
      const evaluated = conferentesSemLider.map((item) =>
        evaluateChecker(item, operationType, pecas, duracao, totalConferentes),
      );
      const ranked = sortRanking(evaluated);
      setEvaluations(ranked);

      const porArea = tagsResult.porArea ?? [];
      handleSectionAccuracyUpdate(tagsResult, porArea, setSectionAccuracy, setIsExtendedTags);

      await salvarHistoricoAvaliacao(ranked, operationType);
    } catch (e) {
      console.error("Error in handleProcess", e);
      Alert.alert("Erro", "Ocorreu um erro ao processar os dados.");
    } finally {
      setProcessing(false);
    }
  };

  return {
    operationType,
    setOperationType,
    rawText,
    setRawText,
    tagsText,
    setTagsText,
    totalPecas,
    setTotalPecas,
    duracaoReal,
    setDuracaoReal,
    evaluations,
    sectionAccuracy,
    isExtendedTags,
    processing,
    previewProd,
    previewTags,
    handlePickFile,
    handleProcess,
  };
}
