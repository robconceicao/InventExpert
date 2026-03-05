import { INVENTORY_PROFILES } from "../config/inventoryEvalConfig";
import type {
  InventoryCheckerEvaluation,
  InventoryCheckerInput,
  InventoryOperationType,
} from "../types";

export function evaluateChecker(
  data: InventoryCheckerInput,
  operationType: InventoryOperationType,
): InventoryCheckerEvaluation {
  const profile = INVENTORY_PROFILES[operationType];
  const { weights, targets, alerts } = profile;

  const qtde = data.qtde > 0 ? data.qtde : 0;
  const qtde1a1 = Math.min(Math.max(data.qtde1a1, 0), qtde);
  const produtividade = Math.max(data.produtividade, 0);
  const erro = Math.max(Math.min(data.erro, qtde), 0);

  const pctErro = qtde > 0 ? (erro / qtde) * 100 : 0;
  const pctBloco = qtde > 0 ? ((qtde - qtde1a1) / qtde) * 100 : 0;

  let scoreQualidade = Math.max(0, 100 - pctErro * 100);
  let scoreProdutividade = Math.min(
    100,
    targets.productivity > 0
      ? (produtividade / targets.productivity) * 100
      : 100,
  );
  let scoreAderencia =
    pctBloco > targets.maxBlockLimit
      ? Math.max(0, 100 - (pctBloco - targets.maxBlockLimit) * 2)
      : 100;

  if (pctErro > targets.erroCritico) {
    scoreProdutividade *= 0.5;
  }

  let scoreFinal =
    weights.quality * scoreQualidade +
    weights.productivity * scoreProdutividade +
    weights.adherence * scoreAderencia;

  const tags: string[] = [];

  if (erro === 0 && qtde >= 1000) {
    scoreFinal += 5;
    tags.push("⭐ Qualidade Premium (Zero Erro)");
  }

  if (produtividade > targets.productivity && pctErro <= targets.erroTolerancia) {
    scoreFinal += 3;
    tags.push("🚀 The Flash Sniper");
  }

  if (pctErro > 1.5 && pctBloco > alerts.criticalBlockLimit) {
    scoreFinal -= 20;
    tags.push("🚨 Risco de Contagem Superficial");
  }

  const scoreFinalClamped = Math.round(
    Math.max(0, Math.min(100, scoreFinal)),
  );

  let nivel: InventoryCheckerEvaluation["nivel"];
  let nivelColor: string;
  if (scoreFinalClamped >= 90) {
    nivel = "EXCELENTE";
    nivelColor = "#16a34a";
  } else if (scoreFinalClamped >= 80) {
    nivel = "BOM";
    nivelColor = "#2563eb";
  } else if (scoreFinalClamped >= 70) {
    nivel = "ATENCAO";
    nivelColor = "#f97316";
  } else {
    nivel = "CRITICO";
    nivelColor = "#dc2626";
  }

  return {
    input: {
      nome: data.nome,
      qtde,
      qtde1a1,
      produtividade,
      erro,
    },
    operationType,
    pctErro,
    pctBloco,
    scoreQualidade,
    scoreProdutividade,
    scoreAderencia,
    scoreFinal: scoreFinalClamped,
    nivel,
    nivelColor,
    tags,
  };
}

export function sortRanking(
  checkers: InventoryCheckerEvaluation[],
): InventoryCheckerEvaluation[] {
  return [...checkers].sort((a, b) => {
    if (b.scoreFinal !== a.scoreFinal) {
      return b.scoreFinal - a.scoreFinal;
    }
    if (a.pctErro !== b.pctErro) {
      return a.pctErro - b.pctErro;
    }
    if (b.input.produtividade !== a.input.produtividade) {
      return b.input.produtividade - a.input.produtividade;
    }
    return a.input.nome.localeCompare(b.input.nome);
  });
}

