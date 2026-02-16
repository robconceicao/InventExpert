import type {
  ClassificacaoGeral,
  ClassificacaoIRB,
  ConferrerEvaluation,
  ConferrerInput,
  EvaluationConfig,
} from "../types";
import { FARMACIA_CONFIG } from "../config/evaluationConfig";

// Percentil: retorna valor no índice correspondente
function percentil(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo] ?? 0;
  return (sorted[lo] ?? 0) + (idx - lo) * ((sorted[hi] ?? 0) - (sorted[lo] ?? 0));
}

/** Normaliza input: calcula produtividade e %erro se omitidos */
function normalizeInput(input: ConferrerInput): ConferrerInput {
  const qtde = input.qtde;
  const horas = input.horas > 0 ? input.horas : 1;
  const produtividade =
    input.produtividade ?? (qtde > 0 ? qtde / horas : 0);
  const percentualErro =
    input.percentualErro ?? (qtde > 0 ? (input.erro / qtde) * 100 : 0);
  const umAum = input.umAum ?? Math.max(0, qtde - (input.bloco ?? 0));
  const bloco = input.bloco ?? Math.max(0, qtde - umAum);
  return {
    ...input,
    produtividade: Math.round(produtividade * 10) / 10,
    percentualErro: Math.round(percentualErro * 100) / 100,
    umAum,
    bloco,
  };
}

/** Pontos de Qualidade (0-100) baseado na taxa de erro */
function calcularPontosQualidade(
  taxaErro: number,
  limites: EvaluationConfig["limites"]["erro"]
): number {
  if (taxaErro <= limites.excelente) return 100;
  if (taxaErro <= limites.bom) {
    return (
      100 -
      ((taxaErro - limites.excelente) /
        (limites.bom - limites.excelente)) *
        20
    );
  }
  if (taxaErro <= limites.atencao) {
    return (
      80 -
      ((taxaErro - limites.bom) / (limites.atencao - limites.bom)) * 30
    );
  }
  const pontosBase = 50 - (taxaErro - limites.atencao) * 5;
  return Math.max(0, pontosBase);
}

/** Pontos de Produtividade (0-100). Meta pode ser dinâmica (mediana do time) */
function calcularPontosProdutividade(
  produtividadeReal: number,
  meta: number
): number {
  if (meta <= 0) return 80; // sem meta = neutro
  const percentualMeta = (produtividadeReal / meta) * 100;
  if (percentualMeta >= 120) return 100;
  if (percentualMeta >= 100) return 85 + ((percentualMeta - 100) / 20) * 15;
  if (percentualMeta >= 80) return 65 + ((percentualMeta - 80) / 20) * 20;
  if (percentualMeta >= 60) return 40 + ((percentualMeta - 60) / 20) * 25;
  return Math.max(0, percentualMeta * 0.67);
}

/** Pontos de Aderência ao Método (0-100) - Farmácia rigorosa */
function calcularPontosMetodo(
  percentualBloco: number,
  taxaErro: number,
  anuenciaLider: boolean | undefined,
  tipoOperacao: string
): number {
  const limiteBloco = tipoOperacao === "farmacia" ? 30 : 60;
  const penalizadorErro = tipoOperacao === "farmacia" ? 2.0 : 1.5;

  let pontosBase: number;
  if (percentualBloco <= limiteBloco) {
    pontosBase = 100 - (percentualBloco / limiteBloco) * 20;
  } else {
    pontosBase =
      80 -
      ((percentualBloco - limiteBloco) / (100 - limiteBloco)) * 80;
  }

  if (percentualBloco > limiteBloco && taxaErro > 2.0) {
    const fatorPenalizacao = 1 + (taxaErro - 2.0) * penalizadorErro;
    pontosBase = pontosBase / fatorPenalizacao;
  }

  // Penalidade adicional se bloco sem anuência (farmácia)
  if (tipoOperacao === "farmacia" && !anuenciaLider && percentualBloco > 20) {
    const excesso = percentualBloco - 20;
    pontosBase -= Math.min(excesso * 0.5, 15);
  }

  return Math.max(0, Math.min(100, pontosBase));
}

/** IRB - Índice de Risco de Bloco */
function calcularIRB(
  percentualBloco: number,
  taxaErro: number,
  anuenciaLider?: boolean
): { valor: number; classificacao: ClassificacaoIRB } {
  const limiteErro = 1.5;
  let irb = (percentualBloco / 100) * (taxaErro / limiteErro);
  if (!anuenciaLider && percentualBloco > 20) {
    irb *= 1.5;
  }
  const classificacao: ClassificacaoIRB =
    irb < 0.3 ? "Baixo" : irb < 0.8 ? "Medio" : irb < 1.5 ? "Alto" : "Critico";
  return { valor: Math.round(irb * 100) / 100, classificacao };
}

/** Bonificações */
function calcularBonificacoes(
  taxaErro: number,
  produtividadeReal: number,
  meta: number,
  erro: number,
  qtde: number,
  config: EvaluationConfig
): number {
  let bonificacoes = 0;
  const { bonificacoes: b } = config;

  if (taxaErro < 0.5 && meta > 0 && produtividadeReal >= meta * 1.1) {
    bonificacoes += b.excelenciaCombinada;
  }
  if (erro === 0 && qtde >= 100) {
    bonificacoes += b.zeroErros;
  }
  if (qtde >= 1000 && taxaErro < 1.0) {
    bonificacoes += b.altoVolumeQualidade;
  }

  return Math.min(bonificacoes, b.maximoBonificacao);
}

/** Penalidades */
function calcularPenalidades(
  percentualBloco: number,
  taxaErro: number,
  produtividadeReal: number,
  meta: number,
  tipoOperacao: string,
  config: EvaluationConfig
): number {
  let penalidades = 0;
  const { penalidades: p } = config;

  if (
    tipoOperacao === "farmacia" &&
    percentualBloco > 50 &&
    taxaErro > 2.0
  ) {
    penalidades += p.blocoExcessivoFarmacia;
  }
  if (meta > 0 && produtividadeReal < meta * 0.4) {
    penalidades += p.produtividadeSuspeita;
  }
  if (taxaErro > 5.0) {
    penalidades += p.erroCritico;
  }

  return Math.min(penalidades, p.maximoPenalidade);
}

/** Avalia um conferente */
export function evaluateConferrer(
  input: ConferrerInput,
  config: EvaluationConfig,
  metaDinamica: number,
  limitesErro?: {
    excelente: number;
    bom: number;
    atencao: number;
    critico: number;
  }
): ConferrerEvaluation {
  const norm = normalizeInput(input);
  const { qtde, horas, erro, umAum, bloco, anuenciaLider } = norm;
  const taxaErro = norm.percentualErro ?? (qtde > 0 ? (erro / qtde) * 100 : 0);
  const produtividadeReal =
    norm.produtividade ?? (horas > 0 && qtde > 0 ? qtde / horas : 0);
  const meta = config.metaProdutividade_itensH === "auto" ? metaDinamica : config.metaProdutividade_itensH;
  const limites = limitesErro ?? config.limites.erro;

  const taxaErroPor1000 = qtde > 0 ? (erro / qtde) * 1000 : 0;
  const acuracia = Math.max(0, 100 - taxaErro);
  const percentual1a1Raw = qtde > 0 ? (umAum / qtde) * 100 : 0;
  const percentualBlocoRaw = qtde > 0 ? (bloco / qtde) * 100 : 0;
  const percentual1a1 = Math.min(100, Math.max(0, percentual1a1Raw));
  const percentualBloco = Math.min(100, Math.max(0, percentualBlocoRaw));

  const { valor: irb, classificacao: irbClassificacao } = calcularIRB(
    percentualBloco,
    taxaErro,
    anuenciaLider
  );

  const pontosQualidade = calcularPontosQualidade(taxaErro, limites);
  const pontosProdutividade = calcularPontosProdutividade(
    produtividadeReal,
    meta
  );
  const pontosMetodo = calcularPontosMetodo(
    percentualBloco,
    taxaErro,
    anuenciaLider,
    config.tipoOperacao
  );

  const bonificacoes = calcularBonificacoes(
    taxaErro,
    produtividadeReal,
    meta,
    erro,
    qtde,
    config
  );
  const penalidades = calcularPenalidades(
    percentualBloco,
    taxaErro,
    produtividadeReal,
    meta,
    config.tipoOperacao,
    config
  );

  const { pesos, classificacao: clas } = config;
  let scoreFinal =
    pesos.qualidade * pontosQualidade +
    pesos.produtividade * pontosProdutividade +
    pesos.metodo * pontosMetodo +
    bonificacoes -
    penalidades;
  scoreFinal = Math.max(0, Math.min(100, Math.round(scoreFinal * 10) / 10));

  let classificacaoGeral: ClassificacaoGeral;
  let badge: string;
  if (scoreFinal >= clas.excelente) {
    classificacaoGeral = "EXCELENTE";
    badge = "⭐";
  } else if (scoreFinal >= clas.bom) {
    classificacaoGeral = "BOM";
    badge = "✅";
  } else if (scoreFinal >= clas.atencao) {
    classificacaoGeral = "ATENCAO";
    badge = "⚠️";
  } else {
    classificacaoGeral = "CRITICO";
    badge = "🚨";
  }

  const alertas: Array<{ tipo: string; mensagem: string }> = [];
  if (config.tipoOperacao === "farmacia" && percentualBloco > 50) {
    alertas.push({
      tipo: "blocoAlto",
      mensagem: "Bloco excessivo para farmácia",
    });
  }
  if (taxaErro > limites.critico) {
    alertas.push({
      tipo: "erroCritico",
      mensagem: `Taxa de erro acima de ${limites.critico}%`,
    });
  }
  if (meta > 0 && produtividadeReal < meta * 0.5) {
    alertas.push({
      tipo: "produtividadeBaixa",
      mensagem: "Produtividade abaixo de 50% da meta",
    });
  }
  if (irb > 1.5) {
    alertas.push({
      tipo: "irbAlto",
      mensagem: "Risco de bloco elevado - revisar contagens",
    });
  }

  return {
    input: norm,
    produtividadeReal,
    taxaErroPercentual: Math.round(taxaErro * 100) / 100,
    taxaErroPor1000: Math.round(taxaErroPor1000 * 10) / 10,
    acuracia: Math.round(acuracia * 100) / 100,
    percentual1a1: Math.round(percentual1a1 * 10) / 10,
    percentualBloco: Math.round(percentualBloco * 10) / 10,
    irb,
    irbClassificacao,
    pontosQualidade: Math.round(pontosQualidade * 10) / 10,
    pontosProdutividade: Math.round(pontosProdutividade * 10) / 10,
    pontosMetodo: Math.round(pontosMetodo * 10) / 10,
    bonificacoes,
    penalidades,
    scoreFinal,
    classificacaoGeral,
    badge,
    alertas,
  };
}

/** Calcula meta dinâmica (mediana das produtividades) e avalia todos */
export function evaluateAllConferrers(
  inputs: ConferrerInput[],
  config: EvaluationConfig = FARMACIA_CONFIG
): {
  evaluations: ConferrerEvaluation[];
  metaDinamica: number;
  resumo: {
    totalConferentes: number;
    totalItens: number;
    taxaMediaErro: number;
    produtividadeMedia: number;
    scoreMedio: number;
  };
} {
  const normalized = inputs.map(normalizeInput);
  const produtividades = normalized
    .filter((n) => n.qtde > 0 && n.horas > 0)
    .map((n) => n.qtde / n.horas);
  const metaDinamica =
    produtividades.length > 0 ? percentil(produtividades, 50) : 150;

  const evaluations = inputs.map((input) =>
    evaluateConferrer(input, config, metaDinamica)
  );

  const totalItens = evaluations.reduce((s, e) => s + e.input.qtde, 0);
  const totalErros = evaluations.reduce((s, e) => s + e.input.erro, 0);
  const taxaMediaErro =
    totalItens > 0 ? (totalErros / totalItens) * 100 : 0;
  const produtividadeMedia =
    evaluations.length > 0
      ? evaluations.reduce((s, e) => s + e.produtividadeReal, 0) /
        evaluations.length
      : 0;
  const scoreMedio =
    evaluations.length > 0
      ? evaluations.reduce((s, e) => s + e.scoreFinal, 0) / evaluations.length
      : 0;

  return {
    evaluations: evaluations.sort((a, b) => b.scoreFinal - a.scoreFinal),
    metaDinamica: Math.round(metaDinamica * 10) / 10,
    resumo: {
      totalConferentes: evaluations.length,
      totalItens,
      taxaMediaErro: Math.round(taxaMediaErro * 100) / 100,
      produtividadeMedia: Math.round(produtividadeMedia * 10) / 10,
      scoreMedio: Math.round(scoreMedio * 10) / 10,
    },
  };
}
