import { INVENTORY_PROFILES } from "../config/inventoryEvalConfig";
import type {
  CheckerExperienceLevel,
  InventoryCheckerEvaluation,
  InventoryCheckerInput,
  InventoryOperationType,
  PerfilComportamental,
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

/**
 * Classifica o perfil comportamental do conferente com base nos padrões
 * de omissão e excesso identificados via produtividade_tag.
 *
 * Lógica de sinais do Qtd(A1):
 *   Qtd(A1) > 0 = auditor achou produto que o conferente PULOU (omissão)
 *   Qtd(A1) < 0 = conferente bipou a mais do que existia (excesso/duplicação)
 *
 * Omissão é mais grave: o produto pulado gera perda financeira invisível no sistema
 * individual, pois sem registro de bip nenhuma matrícula recebe o erro bruto.
 */
export function calcularPerfilComportamental(
  itensPulados: number,
  itensDuplicados: number,
): PerfilComportamental {
  const altoOmissao = itensPulados > 15;
  const altoExcesso = itensDuplicados > 20;
  if (altoOmissao && altoExcesso) return "DESATENTO_GERAL";
  if (altoOmissao) return "PULA_ITENS";
  if (altoExcesso) return "FANTASMA";
  return "EQUILIBRADO";
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

  // =========================================================================
  // ANÁLISE COMPORTAMENTAL — Omissão vs Excesso
  //
  // Fonte: produtividade_tag, coluna Qtd(A1)
  //   Qtd(A1) > 0 → auditor achou produto que o conferente PULOU (itensPulados)
  //   Qtd(A1) < 0 → conferente bipou A MAIS do que existia (itensDuplicados)
  //
  // Por que omissão é MAIS penalizada:
  //   O conferente que pula não recebe erro bruto individual (sem bip = sem linha
  //   de erro na matrícula). Mas o produto não contado gera furo de estoque real,
  //   cujo custo é assumido pela loja. É uma perda financeira invisível no indicador
  //   de produtividade, visível apenas no relatório de seções (produtividade_tag).
  //   Esta penalidade corrige essa assimetria.
  //
  // Por que excesso é MENOS penalizado:
  //   A duplicação é capturada pela auditoria de divergência antes do fechamento.
  //   O dano financeiro direto é menor porque o ajuste é feito em tempo real.
  // =========================================================================
  const itensPulados    = data.itensPulados    || 0;
  const itensDuplicados = data.itensDuplicados || 0;

  if (itensPulados > 0) {
    // Penalidade de omissão: 0.7 pt por item pulado, máximo 40 pts
    // (anterior: 0.5 pt, máximo 30 pts — aumentado para refletir impacto real)
    const penalidadeOmissao = Math.min(itensPulados * 0.7, 40);
    scoreFinal -= penalidadeOmissao;

    if (itensPulados > 15) {
      tags.push("🚨 O 'Conferente que Pula' (Omissões altas)");
    } else if (itensPulados > 5) {
      tags.push("⚠️ Atenção à Varredura (Omissões moderadas)");
    }
  }

  if (itensDuplicados > 0) {
    // Penalidade de excesso: 0.2 pt por item duplicado, máximo 20 pts (mantido)
    const penalidadeExcesso = Math.min(itensDuplicados * 0.2, 20);
    scoreFinal -= penalidadeExcesso;

    if (itensDuplicados > 20) {
      tags.push("🔄 Fantasmas (Excesso de repetições)");
    }
  }

  // Perfil oposto: alta duplicação com baixa omissão (conta demais, pula pouco)
  if (itensDuplicados > 20 && itensPulados <= 5) {
    tags.push("🔄 O Oposto: Duplicador (bipa mais, pula menos)");
  }

  // ICSI — Índice de Consistência Seção vs. Item
  // Mede se os erros individuais são "diretos" (alto ICSI) ou "ocultos por compensação" (baixo ICSI)
  let icsi: number | undefined;
  const erroSecao = data.erroSecao;

  if (erroSecao !== undefined && erro > 0) {
    icsi = Math.min(erroSecao / erro, 1.0);
    if (icsi < 0.5 && erro > 10) {
      tags.push("⚠️ Erros Compensados (risco oculto na seção)");
    }
  } else if (erroSecao !== undefined && erro === 0 && erroSecao === 0) {
    icsi = 1.0;
  }

  // PERFIL COMPORTAMENTAL — classificação final derivada da análise de sinais
  const perfilComportamental = calcularPerfilComportamental(itensPulados, itensDuplicados);

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
    perfilComportamental,
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

/**
 * Distribui a equipe por perfil comportamental.
 * Útil para o relatório gerencial identificar padrões de erro coletivos.
 * Disponível apenas quando tags estendidos (produtividade_tag) foram importados.
 */
export function getDistribuicaoPerfilComportamental(
  evaluations: InventoryCheckerEvaluation[],
) {
  return {
    PULA_ITENS:      evaluations.filter(e => e.perfilComportamental === "PULA_ITENS").length,
    FANTASMA:        evaluations.filter(e => e.perfilComportamental === "FANTASMA").length,
    DESATENTO_GERAL: evaluations.filter(e => e.perfilComportamental === "DESATENTO_GERAL").length,
    EQUILIBRADO:     evaluations.filter(e => e.perfilComportamental === "EQUILIBRADO").length,
  };
}
