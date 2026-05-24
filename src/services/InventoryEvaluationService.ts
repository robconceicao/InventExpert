import { INVENTORY_PROFILES } from "../config/inventoryEvalConfig";
import type {
  CheckerExperienceLevel,
  InventoryCheckerEvaluation,
  InventoryCheckerInput,
  InventoryOperationType,
  SectionAccuracyRecord,
} from "../types";

function getExperienciaFator(nivel: CheckerExperienceLevel): number {
  switch (nivel) {
    case "novato":  return 0.70;
    case "junior":  return 0.85;
    case "pleno":   return 1.00;
    case "senior":  return 1.15;
    case "expert":  return 1.30;
    default:        return 1.00;
  }
}

/**
 * Nova fórmula de qualidade — curva exponencial calibrada por tipo de operação.
 *
 * Anterior (linear):  scoreQualidade = 100 - pctErro * 100
 *   → 1% erro = 0 pts (muito punitivo, não distinguia bem entre 0.5% e 3%)
 *
 * Nova (exponencial): scoreQualidade = 100 * e^(-k * pctErro)
 *   → Dá crédito gradual: 0% erro = 100, 1% erro = ~78 (farm), 5% erro = ~5
 *   → k é calibrado por operationType (farm > loja_geral > supermercado)
 */
function calcularScoreQualidade(pctErro: number, k: number): number {
  const score = 100 * Math.exp(-k * pctErro);
  return Math.max(0, Math.min(100, score));
}

function calcularPontosVolume(icv: number, nivelExperiencia: CheckerExperienceLevel): number {
  let pontos = Math.min(icv, 150);
  
  const ajustes = {
    novato:  { bonus: 20, penalidade: 0.5 },
    junior:  { bonus: 10, penalidade: 0.7 },
    pleno:   { bonus: 0,  penalidade: 1.0 },
    senior:  { bonus: -10, penalidade: 1.3 },
    expert:  { bonus: -15, penalidade: 1.5 },
  };
  
  const ajuste = ajustes[nivelExperiencia] || ajustes.pleno;
  
  if (icv >= 100) {
    pontos = Math.min(pontos + ajuste.bonus, 100);
  } else {
    const deficit = 100 - icv;
    pontos = icv - (deficit * ajuste.penalidade);
  }
  
  return Math.max(0, Math.min(100, pontos));
}

export function evaluateChecker(
  data: InventoryCheckerInput,
  operationType: InventoryOperationType,
  totalPecasLoja: number = 0,
  duracaoRealInventario: number = 5,
  numeroConferentes: number = 1
): InventoryCheckerEvaluation {
  const profile = INVENTORY_PROFILES[operationType];
  const { weights, targets, alerts } = profile;
  const k = (profile as any).qualityDecayRate ?? 1.0;

  const qtde        = data.qtde > 0 ? data.qtde : 0;
  const qtde1a1     = Math.min(Math.max(data.qtde1a1, 0), qtde);
  const produtividade = Math.max(data.produtividade, 0);
  const erro        = Math.max(Math.min(data.erro, qtde), 0);

  const pctErro  = qtde > 0 ? (erro / qtde) * 100 : 0;
  const pctBloco = qtde > 0 ? ((qtde - qtde1a1) / qtde) * 100 : 0;

  // QUALIDADE — nova curva exponencial calibrada
  let scoreQualidade = calcularScoreQualidade(pctErro, k);

  // PRODUTIVIDADE
  let scoreProdutividade = Math.min(
    100,
    targets.productivity > 0
      ? (produtividade / targets.productivity) * 100
      : 100,
  );

  // ADERÊNCIA AO MÉTODO
  let scoreAderencia =
    pctBloco > targets.maxBlockLimit
      ? Math.max(0, 100 - (pctBloco - targets.maxBlockLimit) * 2)
      : 100;

  // Penalidade de produtividade quando erro está acima do crítico
  if (pctErro > targets.erroCritico) {
    scoreProdutividade *= 0.5;
  }

  // CÁLCULO DE VOLUME (ICV)
  const nivelExp   = data.experiencia || "pleno";
  const fatorExp   = getExperienciaFator(nivelExp);
  const fatorTempo = duracaoRealInventario > 0 ? 5 / duracaoRealInventario : 1;
  
  let minimoIndividual = 0;
  let icv             = 0;
  let pontosVolume    = 100;
  let bonusVolume     = 0;
  let penalidadeVolume = 0;

  if (totalPecasLoja > 0 && numeroConferentes > 0) {
    const minimoBase   = (totalPecasLoja / numeroConferentes) * fatorTempo;
    minimoIndividual   = Math.round(minimoBase * fatorExp);
    icv                = minimoIndividual > 0 ? (qtde / minimoIndividual) * 100 : 100;
    pontosVolume       = calcularPontosVolume(icv, nivelExp);

    // Bônus Volume
    if (icv >= 100 && pctErro <= 3.0 && pctBloco <= 20) {
      if (icv >= 150) bonusVolume = 10;
      else if (icv >= 135) bonusVolume = 7;
      else if (icv >= 120) bonusVolume = 5;
      else if (icv >= 110) bonusVolume = 3;
      else if (icv >= 100) bonusVolume = 1;
    }

    // Penalidade Volume
    if (icv < 100) {
      const deficit = 100 - icv;
      if (deficit >= 30) penalidadeVolume = 15;
      else if (deficit >= 20) penalidadeVolume = 10;
      else if (deficit >= 10) penalidadeVolume = 5;
      else penalidadeVolume = 2;

      if (nivelExp === "expert" || nivelExp === "senior") {
        penalidadeVolume = Math.round(penalidadeVolume * 1.5);
      }
      penalidadeVolume = Math.min(penalidadeVolume, 20);
    }
  }

  // PESOS DA AVALIAÇÃO
  let scoreFinal =
    weights.quality      * scoreQualidade +
    weights.productivity * scoreProdutividade +
    weights.adherence    * scoreAderencia +
    ((weights as any).volume || 0.1) * pontosVolume;

  scoreFinal += bonusVolume;
  scoreFinal -= penalidadeVolume;

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

  // PROTEÇÃO ANTI-GAMIFICAÇÃO
  if (totalPecasLoja > 0) {
    if (pctBloco > 20 && icv > 150) {
      tags.push("🚨 Volume Suspeito: Muito Bloco");
    }
    if (icv > 200 && pctErro < 0.5) {
      tags.push("🚨 Volume Irreal (Investigar Fraude)");
    }
    const prodMax = targets.productivity * 3;
    if (produtividade > prodMax) {
      tags.push("🚨 Produtividade Impossível");
    }
  }

  // ANÁLISE COMPORTAMENTAL (Omissão vs Excesso)
  const itensPulados    = data.itensPulados    || 0;
  const itensDuplicados = data.itensDuplicados || 0;
  
  if (itensPulados > 0) {
    const penalidadeOmissao = Math.min(itensPulados * 0.5, 30);
    scoreFinal -= penalidadeOmissao;
    if (itensPulados > 15) {
      tags.push("🚨 O 'Conferente que Pula' (Omissões altas)");
    }
  }

  if (itensDuplicados > 0) {
    const penalidadeExcesso = Math.min(itensDuplicados * 0.2, 20);
    scoreFinal -= penalidadeExcesso;
    if (itensDuplicados > 20) {
      tags.push("🔄 Fantasmas (Excesso de repetições)");
    }
  }

  // ICSI — Índice de Consistência Seção vs. Item
  // Mede se os erros individuais são "diretos" (alto ICSI) ou "ocultos por compensação" (baixo ICSI)
  // erroSecao = Σ|Qtd(A1)| — sempre <= erro individual (os erros se compensam nas seções)
  let icsi: number | undefined;
  const erroSecao = data.erroSecao;

  if (erroSecao !== undefined && erro > 0) {
    // ICSI: quanto do erro individual sobreviveu como erro de seção (sem se compensar)
    // 1.0 = todos os erros são diretos (pior caso para o conferente)
    // 0.0 = todos os erros se compensaram nas seções (risco oculto — seção parece boa mas não foi)
    icsi = Math.min(erroSecao / erro, 1.0);

    // Risco oculto: erros altos mas ICSI baixo (compensação interna na seção mascara o problema)
    if (icsi < 0.5 && erro > 10) {
      tags.push("⚠️ Erros Compensados (risco oculto na seção)");
    }
  } else if (erroSecao !== undefined && erro === 0 && erroSecao === 0) {
    icsi = 1.0; // zero erros em ambos = perfeito
  }

  const scoreFinalClamped = Math.round(
    Math.max(0, Math.min(100, scoreFinal)),
  );

  let nivel: InventoryCheckerEvaluation["nivel"];
  let nivelColor: string;
  if (scoreFinalClamped >= 90) {
    nivel = "EXCELENTE"; nivelColor = "#16a34a";
  } else if (scoreFinalClamped >= 80) {
    nivel = "BOM";       nivelColor = "#2563eb";
  } else if (scoreFinalClamped >= 70) {
    nivel = "ATENCAO";   nivelColor = "#f97316";
  } else {
    nivel = "CRITICO";   nivelColor = "#dc2626";
  }

  return {
    input: {
      nome: data.nome,
      matricula: data.matricula,
      qtde,
      qtde1a1,
      produtividade,
      erro,
      experiencia: nivelExp,
      itensPulados,
      itensDuplicados,
      erroSecao,
      numSecoes: data.numSecoes,
    },
    operationType,
    pctErro,
    pctBloco,
    scoreQualidade,
    scoreProdutividade,
    scoreAderencia,
    minimoEsperado: minimoIndividual,
    icv,
    pontosVolume,
    bonusVolume,
    penalidadeVolume,
    icsi,
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
    if (b.scoreFinal !== a.scoreFinal) return b.scoreFinal - a.scoreFinal;
    if (a.pctErro   !== b.pctErro)   return a.pctErro - b.pctErro;
    if (b.input.produtividade !== a.input.produtividade)
      return b.input.produtividade - a.input.produtividade;
    return a.input.nome.localeCompare(b.input.nome);
  });
}

/**
 * Distribui o ranking em categorias de performance.
 * Útil para o resumo gerencial (pills coloridas na UI).
 */
export function getDistribuicaoNiveis(evaluations: InventoryCheckerEvaluation[]) {
  return {
    EXCELENTE: evaluations.filter(e => e.nivel === "EXCELENTE").length,
    BOM:       evaluations.filter(e => e.nivel === "BOM").length,
    ATENCAO:   evaluations.filter(e => e.nivel === "ATENCAO").length,
    CRITICO:   evaluations.filter(e => e.nivel === "CRITICO").length,
  };
}
