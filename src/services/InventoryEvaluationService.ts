// @ts-nocheck
import {
  INVENTORY_PROFILES,
  getViolacoesBloco,
  PENALIDADE_BLOCO_AREA_CRITICA,
  PENALIDADE_BLOCO_EXCESSO_ALTO,
  PENALIDADE_BLOCO_EXCESSO_LEVE
} from "../config/inventoryEvalConfig";
import type {
  InventoryCheckerEvaluation,
  InventoryCheckerInput,
  InventoryOperationType,
  PerfilComportamental,
  SectionAccuracyRecord,
  ViolacaoBloco,
  ContagemDetalhada
} from "../types";

export function calcularBlocoPorArea(
  matricula: string,
  contagens: ContagemDetalhada[]
): Map<string, number> {
  const doAgente = contagens.filter(c => c.matricula === matricula);
  const result   = new Map<string, number>();

  const areas = [...new Set(doAgente.map(c => c.area_nome))];
  for (const area of areas) {
    const itens    = doAgente.filter(c => c.area_nome === area);
    const totalQtd = itens.reduce((s, c) => s + c.quantidade, 0);
    const blocoQtd = itens.filter(c => c.is_bloco).reduce((s, c) => s + c.quantidade, 0);
    result.set(area, totalQtd > 0 ? (blocoQtd / totalQtd) * 100 : 0);
  }
  return result;
}

export function detectarViolacoesBloco(
  matricula: string,
  contagens: ContagemDetalhada[],
  limites: Array<{
    tipo_operacao: string;
    nome_area: string;
    limite_pct: number;
    area_critica: boolean;
  }>,
  tipoOperacao: InventoryOperationType
): ViolacaoBloco[] {
  if (tipoOperacao !== 'FARMACIA') return [];  // outros setores: sem penalidade

  const blocoPorArea = calcularBlocoPorArea(matricula, contagens);
  const violacoes: ViolacaoBloco[] = [];

  for (const [area, pct] of blocoPorArea) {
    const limite = limites.find(
      l => l.tipo_operacao === tipoOperacao && l.nome_area === area
    );
    if (!limite) {
      console.warn(`[Avaliação] Área sem limite configurado: "${area}" — ignorando.`);
      continue;
    }
    if (limite.limite_pct >= 9999) continue;  // sem limite definido
    if (pct > limite.limite_pct) {
      violacoes.push({
        area_nome:     area,
        limite_pct:    limite.limite_pct,
        real_pct:      pct,
        area_critica:  limite.area_critica,
        excesso_fator: limite.limite_pct > 0 ? pct / limite.limite_pct : Infinity,
      });
    }
  }
  return violacoes;
}

export function calcularPerfilComportamental(
  p1: number | InventoryCheckerInput,
  p2?: number,
  p3?: number
): PerfilComportamental {
  let qtde = 0;
  let pulados = 0;
  let duplicados = 0;

  if (typeof p1 === 'object') {
    qtde = p1.qtde;
    pulados = p1.itensPulados || 0;
    duplicados = p1.itensDuplicados || 0;
  } else {
    pulados = p1;
    duplicados = p2 || 0;
    qtde = p3 || 0;
  }

  if (qtde === 0) return "EQUILIBRADO";

  const limiteErroNormal = Math.max(10, qtde * 0.01);

  if (pulados <= limiteErroNormal && duplicados <= limiteErroNormal) return "EQUILIBRADO";
  if (pulados > duplicados * 2 && pulados > limiteErroNormal) return "PULA_ITENS";
  if (duplicados > pulados * 2 && duplicados > limiteErroNormal) return "FANTASMA";
  return "DESATENTO_GERAL";
}

export function evaluateChecker(
  data: InventoryCheckerInput,
  operationType: InventoryOperationType,
  totalPecasLoja: number = 0,
  duracaoRealInventario: number = 5,
  numeroConferentes: number = 1,
  violacoesManuais?: ViolacaoBloco[],
  secoes: SectionAccuracyRecord[] = []
): InventoryCheckerEvaluation {
  // Ignora líderes retornando um null mascarado para o typescript
  if (data.role === "LÍDER" || data.role === "LIDER" || data.nome.includes("LIDER") || data.nome.includes("LÍDER")) {
    return null as unknown as InventoryCheckerEvaluation;
  }

  const profile = INVENTORY_PROFILES[operationType];
  const { weights, targets, alerts } = profile;

  const qtde = data.qtde > 0 ? data.qtde : 0;
  const qtde1a1 = Math.min(Math.max(data.qtde1a1, 0), qtde);
  const produtividade = Math.max(data.produtividade, 0);
  const erro = Math.max(Math.min(data.erro, qtde), 0);

  const pctErro = qtde > 0 ? (erro / qtde) * 100 : 0;
  const pctBloco = qtde > 0 ? ((qtde - qtde1a1) / qtde) * 100 : 0;

  const perfil = calcularPerfilComportamental(data);
  const penalidadeComportamental = ((data.itensPulados || 0) * 0.7) + ((data.itensDuplicados || 0) * 0.2);

  let qualidadeBase = Math.max(0, 100 * Math.exp(-1.5 * pctErro) - penalidadeComportamental);

  const secoesParaAvaliacao = secoes.map(s => ({ area: s.area || "", pctBloco: s.pctBloco || 0 }));
  const violacoes = violacoesManuais && violacoesManuais.length > 0 ? violacoesManuais : getViolacoesBloco(secoesParaAvaliacao, operationType);

  let qualidadePenalty = 0;
  for (const v of violacoes) {
    // Compatibilidade com old e new model
    const critica = v.area_critica ?? v.critica ?? false;
    const limit_pct = v.limite_pct ?? v.limitePermitido ?? 0;
    const excesso = v.excesso_fator ?? ((v.real_pct ?? v.pctBloco ?? 0) / (limit_pct > 0 ? limit_pct : 1));

    if (critica && limit_pct === 0) {
      qualidadePenalty += PENALIDADE_BLOCO_AREA_CRITICA;
    } else if (excesso > 2) {
      qualidadePenalty += PENALIDADE_BLOCO_EXCESSO_ALTO;
    } else {
      qualidadePenalty += PENALIDADE_BLOCO_EXCESSO_LEVE;
    }

    const vArea = v.area || v.area_nome || "";
    const idx = secoes.findIndex(s => (s.area || "").toUpperCase() === vArea.toUpperCase());
    if (idx >= 0) {
      secoes[idx].violacaoBloco = v;
    }
  }

  let scoreQualidade = Math.max(0, qualidadeBase - qualidadePenalty);

  // REGRA ABSOLUTA: qualidade nunca pode ser 100 quando há violações de bloco
  if (violacoes.length > 0 && scoreQualidade >= 100) {
    console.error('[Avaliação] BUG: qualidade = 100 com violações de bloco.');
    scoreQualidade = 99;
  }

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

  if (perfil === "PULA_ITENS" && (data.itensPulados || 0) > 10) {
    tags.push("🚩 Pula itens (Alto índice de omissão)");
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
      matricula: data.matricula,
      modalidadeContrato: data.modalidadeContrato,
      qtde,
      qtde1a1,
      produtividade,
      erro,
      itensPulados: data.itensPulados,
      itensDuplicados: data.itensDuplicados,
      erroSecao: data.erroSecao,
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
    secoes,
    perfil,
    violacoes,
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

