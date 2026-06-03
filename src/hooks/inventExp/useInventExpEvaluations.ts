import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";

import { getDistribuicaoNiveis } from "../../services/InventoryEvaluationService";
import type {
  InventoryCheckerEvaluation,
  InventoryOperationType,
  ModalidadeContrato,
} from "../../types";

const PROFILE_STORAGE_KEY = "inventexp_last_profile";

export function useInventExpEvaluations(
  evaluations: InventoryCheckerEvaluation[],
  operationType: InventoryOperationType,
  setOperationType: (t: InventoryOperationType) => void,
) {
  const [modalidades, setModalidades] = useState<Record<string, ModalidadeContrato>>({});

  useEffect(() => {
    void AsyncStorage.getItem(PROFILE_STORAGE_KEY).then((v) => {
      if (v === "FARMACIA" || v === "SUPERMERCADO" || v === "LOJA_GERAL") {
        setOperationType(v);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega perfil salvo uma vez
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(PROFILE_STORAGE_KEY, operationType);
  }, [operationType]);

  const MODALIDADE_CYCLE: ModalidadeContrato[] = ["CLT", "INTERMITENTE", "FREELANCE"];
  const MODALIDADE_COLOR: Record<ModalidadeContrato, string> = {
    CLT: "#2563eb",
    INTERMITENTE: "#059669",
    FREELANCE: "#f59e0b",
  };
  const MODALIDADE_LABEL: Record<ModalidadeContrato, string> = {
    CLT: "CLT",
    INTERMITENTE: "INT",
    FREELANCE: "FREE",
  };

  const getModalidade = (nome: string): ModalidadeContrato =>
    modalidades[nome.toLowerCase().trim()] ?? "CLT";

  const cycleModalidade = (nome: string) => {
    const key = nome.toLowerCase().trim();
    const current = modalidades[key] ?? "CLT";
    const idx = MODALIDADE_CYCLE.indexOf(current);
    const next = MODALIDADE_CYCLE[(idx + 1) % MODALIDADE_CYCLE.length];
    setModalidades((prev) => ({ ...prev, [key]: next }));
  };

  const resumo = useMemo(() => {
    if (evaluations.length === 0) return null;
    const totalConferentes = evaluations.length;
    const totalItens = evaluations.reduce((s, e) => s + e.input.qtde, 0);
    const totalErros = evaluations.reduce((s, e) => s + e.input.erro, 0);
    const taxaMediaErro = totalItens > 0 ? (totalErros / totalItens) * 100 : 0;
    const produtividadeMedia =
      evaluations.reduce((s, e) => s + e.input.produtividade, 0) / evaluations.length;
    const scoreMedio =
      evaluations.reduce((s, e) => s + e.scoreFinal, 0) / evaluations.length;
    const dist = getDistribuicaoNiveis(evaluations);
    return {
      totalConferentes,
      totalItens,
      taxaMediaErro: Math.round(taxaMediaErro * 100) / 100,
      produtividadeMedia: Math.round(produtividadeMedia * 10) / 10,
      scoreMedio: Math.round(scoreMedio * 10) / 10,
      dist,
    };
  }, [evaluations]);

  const top3 = useMemo(() => evaluations.slice(0, 3), [evaluations]);

  const radarRisco = useMemo(
    () =>
      evaluations.filter(
        (e) =>
          e.nivel === "CRITICO" ||
          e.tags.includes("🚨 Risco de Contagem Superficial"),
      ),
    [evaluations],
  );

  return {
    resumo,
    top3,
    radarRisco,
    getModalidade,
    cycleModalidade,
    MODALIDADE_COLOR,
    MODALIDADE_LABEL,
  };
}
