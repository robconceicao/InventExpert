import {
  INVENTORY_PROFILES,
  getLimitesBlocoFallback,
  getViolacoesBloco,
  LIMITE_BLOCO_SEM_LIMITE,
  PENALIDADE_BLOCO_AREA_CRITICA,
  PENALIDADE_BLOCO_EXCESSO_ALTO,
  PENALIDADE_BLOCO_EXCESSO_LEVE,
  type LimiteBlocoRow,
} from "../config/inventoryEvalConfig";
import {
  buildViolacaoBloco,
  getSectionAreaNome,
  getSectionBlocoPct,
  getViolacaoArea,
  getViolacaoCritica,
  getViolacaoExcessoFator,
  getViolacaoLimitePct,
  normalizeModalidade,
  type ContagemDetalhada,
  type InventoryCheckerEvaluation,
  type InventoryCheckerInput,
  type InventoryOperationType,
  type PerfilComportamental,
  type SectionAccuracyRecord,
  type ViolacaoBloco,
} from "../types";

// ---------------------------------------------------------------------------
// Bloco por área (.prc)
// ---------------------------------------------------------------------------

export function calcularBlocoPorArea(
  matricula: string,
  contagens: ContagemDetalhada[],
): Map<string, number> {
  const doAgente = contagens.filter((c) => c.matricula === matricula);
  const result = new Map<string, number>();

  const areas = [
    ...new Set(
      doAgente
        .map((c) => (c.area_nome || "").trim())
        .filter((a) => a.length > 0),
    ),
  ];

  for (const area of areas) {
    const itens = doAgente.filter((c) => (c.area_nome || "").trim() === area);
    const totalQtd = itens.reduce((s, c) => s + c.quantidade, 0);
    const blocoQtd = itens
      .filter((c) => c.is_bloco)
      .reduce((s, c) => s + c.quantidade, 0);
    result.set(area, totalQtd > 0 ? (blocoQtd / totalQtd) * 100 : 0);
  }
  return result;
}

/**
 * Detecta violações de bloco a partir de contagens .prc.
 * Operação ≠ FARMACIA → [] imediatamente.
 * Área sem limite → console.warn, sem penalidade.
 */
export function detectarViolacoesBloco(
  matricula: string,
  contagens: ContagemDetalhada[],
  limites: LimiteBlocoRow[],
  tipoOperacao: InventoryOperationType,
): ViolacaoBloco[] {
  if (tipoOperacao !== "FARMACIA") return [];

  const blocoPorArea = calcularBlocoPorArea(matricula, contagens);
  const violacoes: ViolacaoBloco[] = [];

  for (const [area, pct] of blocoPorArea) {
    const limite = limites.find(
      (l) =>
        l.tipo_operacao === tipoOperacao &&
        l.nome_area.toUpperCase() === area.toUpperCase(),
    );
    if (!limite) {
      console.warn(
        `[Avaliação] Área sem limite configurado: "${area}" — ignorando (sem penalidade).`,
      );
      continue;
    }
    if (limite.limite_pct >= LIMITE_BLOCO_SEM_LIMITE) continue;
    if (pct > limite.limite_pct) {
      violacoes.push(
        buildViolacaoBloco({
          area_nome: area,
          real_pct: pct,
          limite_pct: limite.limite_pct,
          area_critica: limite.area_critica,
        }),
      );
    }
  }
  return violacoes;
}

// ---------------------------------------------------------------------------
// Perfil comportamental
// ---------------------------------------------------------------------------

export function calcularPerfilComportamental(
  p1: number | InventoryCheckerInput,
  p2?: number,
  p3?: number,
): PerfilComportamental {
  let qtde = 0;
  let pulados = 0;
  let duplicados = 0;

  if (typeof p1 === "object") {
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

  if (pulados <= limiteErroNormal && duplicados <= limiteErroNormal) {
    return "EQUILIBRADO";
  }
  if (pulados > duplicados * 2 && pulados > limiteErroNormal) return "PULA_ITENS";
  if (duplicados > pulados * 2 && duplicados > limiteErroNormal) return "FANTASMA";
  return "DESATENTO_GERAL";
}

// ---------------------------------------------------------------------------
// Exclusão do líder
// ---------------------------------------------------------------------------

function normalizeLeaderToken(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Líder da operação não entra na avaliação automática.
 * Fontes: role, nome contendo LIDER, ou match com leaderName (Acompanhamento).
 */
export function isLeaderExcluded(
  data: InventoryCheckerInput,
  leaderName?: string,
): boolean {
  const role = normalizeLeaderToken(data.role || "");
  // after NFD, LÍDER → LIDER
  if (role === "LIDER") return true;

  const nome = normalizeLeaderToken(data.nome || "");
  if (nome.includes("LIDER")) return true;

  if (leaderName && leaderName.trim()) {
    const ln = normalizeLeaderToken(leaderName);
    if (nome === ln || nome.includes(ln)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Resolução unificada de violações
// ---------------------------------------------------------------------------

function normalizeViolacoes(list: ViolacaoBloco[]): ViolacaoBloco[] {
  return list.map((v) =>
    buildViolacaoBloco({
      area_nome: getViolacaoArea(v),
      real_pct: v.real_pct ?? v.pctBloco ?? 0,
      limite_pct: getViolacaoLimitePct(v),
      area_critica: getViolacaoCritica(v),
      excesso_fator: v.excesso_fator,
    }),
  );
}

/**
 * Prioridade:
 * 1) violacoesManuais (testes / override)
 * 2) contagensDetalhadas (.prc) + limites → detectarViolacoesBloco
 * 3) secoes (PRODUÇÃO_SEÇÃO) → getViolacoesBloco
 */
function resolverViolacoes(args: {
  data: InventoryCheckerInput;
  operationType: InventoryOperationType;
  violacoesManuais?: ViolacaoBloco[];
  secoes: SectionAccuracyRecord[];
  limites: LimiteBlocoRow[];
}): ViolacaoBloco[] {
  const { data, operationType, violacoesManuais, secoes, limites } = args;

  if (violacoesManuais && violacoesManuais.length > 0) {
    return normalizeViolacoes(violacoesManuais);
  }

  const contagens =
    data.contagensDetalhadas && data.contagensDetalhadas.length > 0
      ? data.contagensDetalhadas
      : undefined;

  if (contagens && data.matricula) {
    return detectarViolacoesBloco(
      data.matricula,
      contagens,
      limites,
      operationType,
    );
  }

  const secoesParaAvaliacao = secoes.map((s) => ({
    area: getSectionAreaNome(s),
    pctBloco: getSectionBlocoPct(s),
  }));
  return getViolacoesBloco(secoesParaAvaliacao, operationType);
}

function aplicarPenalidadeBloco(violacoes: ViolacaoBloco[]): number {
  let qualidadePenalty = 0;
  for (const v of violacoes) {
    const critica = getViolacaoCritica(v);
    const limitPct = getViolacaoLimitePct(v);
    const excesso = getViolacaoExcessoFator(v);

    if (critica && limitPct === 0) {
      qualidadePenalty += PENALIDADE_BLOCO_AREA_CRITICA;
    } else if (excesso > 2) {
      qualidadePenalty += PENALIDADE_BLOCO_EXCESSO_ALTO;
    } else {
      qualidadePenalty += PENALIDADE_BLOCO_EXCESSO_LEVE;
    }
  }
  return qualidadePenalty;
}

function marcarViolacoesNasSecoes(
  secoes: SectionAccuracyRecord[],
  violacoes: ViolacaoBloco[],
): void {
  for (const v of violacoes) {
    const vArea = getViolacaoArea(v).toUpperCase();
    const idx = secoes.findIndex(
      (s) => getSectionAreaNome(s).toUpperCase() === vArea,
    );
    if (idx >= 0) {
      secoes[idx].violacaoBloco = v;
      secoes[idx].violacao_bloco = true;
      secoes[idx].area_critica =
        secoes[idx].area_critica || getViolacaoCritica(v);
    }
  }
}

// ---------------------------------------------------------------------------
// Motor principal
// ---------------------------------------------------------------------------

/**
 * Avalia um conferente.
 * Retorna `null` quando o conferente é líder (excluído).
 *
 * Assinatura posicional mantida por compatibilidade com telas e testes.
 * `limites` opcional: se vazio/ausente, usa fallback local da migration.
 * `leaderName` opcional: nome do líder vindo do módulo Acompanhamento.
 */
export function evaluateChecker(
  data: InventoryCheckerInput,
  operationType: InventoryOperationType,
  _totalPecasLoja: number = 0,
  _duracaoRealInventario: number = 5,
  _numeroConferentes: number = 1,
  violacoesManuais?: ViolacaoBloco[],
  secoes: SectionAccuracyRecord[] = [],
  limites?: LimiteBlocoRow[],
  leaderName?: string,
): InventoryCheckerEvaluation | null {
  if (isLeaderExcluded(data, leaderName)) {
    return null;
  }

  const profile = INVENTORY_PROFILES[operationType];
  const { weights, targets, alerts, qualityDecayK } = profile;

  const qtde = data.qtde > 0 ? data.qtde : 0;
  const qtde1a1 = Math.min(Math.max(data.qtde1a1, 0), qtde);
  const produtividade = Math.max(data.produtividade, 0);
  const erro = Math.max(Math.min(data.erro, qtde), 0);

  const pctErro = qtde > 0 ? (erro / qtde) * 100 : 0;
  const pctBloco = qtde > 0 ? ((qtde - qtde1a1) / qtde) * 100 : 0;

  const perfil = calcularPerfilComportamental(data);
  const penalidadeComportamental =
    (data.itensPulados || 0) * 0.7 + (data.itensDuplicados || 0) * 0.2;

  // Qualidade exponencial com k do perfil (não mais 1.5 fixo)
  const qualidadeBase = Math.max(
    0,
    100 * Math.exp(-qualityDecayK * pctErro) - penalidadeComportamental,
  );

  const limitesEfetivos =
    limites && limites.length > 0
      ? limites
      : getLimitesBlocoFallback(operationType);

  const violacoes = resolverViolacoes({
    data,
    operationType,
    violacoesManuais,
    secoes,
    limites: limitesEfetivos,
  });

  const qualidadePenalty = aplicarPenalidadeBloco(violacoes);
  marcarViolacoesNasSecoes(secoes, violacoes);

  let scoreQualidade = Math.max(0, qualidadeBase - qualidadePenalty);

  // REGRA ABSOLUTA: qualidade nunca pode ser 100 quando há violações de bloco
  if (violacoes.length > 0 && scoreQualidade >= 100) {
    console.error("[Avaliação] BUG: qualidade = 100 com violações de bloco.");
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

  // Aderência também reage a violações por área (farmácia)
  if (violacoes.length > 0) {
    const penalAderencia = Math.min(100, violacoes.length * 15);
    scoreAderencia = Math.max(0, scoreAderencia - penalAderencia);
  }

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

  if (
    produtividade > targets.productivity &&
    pctErro <= targets.erroTolerancia
  ) {
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

  if (violacoes.some((v) => getViolacaoCritica(v))) {
    tags.push("🚨 Violação de área crítica (bloco)");
  }

  const scoreFinalClamped = Math.round(Math.max(0, Math.min(100, scoreFinal)));

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

  const modalidade = data.modalidadeContrato ?? data.modalidade;

  return {
    input: {
      nome: data.nome,
      matricula: data.matricula,
      modalidadeContrato: modalidade,
      modalidade,
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
    // espelho v2
    matricula: data.matricula,
    nome: data.nome,
    modalidade: modalidade ? normalizeModalidade(modalidade) : undefined,
    violacoesBloco: violacoes,
    rankingPos: undefined,
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
