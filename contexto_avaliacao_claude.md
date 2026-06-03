# Estrutura e L�gica do InventExpert - M�dulo de Avalia��o de Conferentes

Este documento cont�m os tipos, configura��es, l�gica de c�lculo (servi�os), parsers, utilit�rios de relat�rio e as telas/componentes principais do m�dulo de avalia��o.


## Arquivo: src\types\index.ts
`	ypescript
export interface ReportA {
  lojaNum: string;
  lojaNome: string;
  enderecoLoja?: string;
  qtdColaboradores: string;
  lider: string;
  hrChegada: string;
  inicioContagemEstoque: string;
  terminoContagemEstoque: string;
  inicioContagemLoja: string;
  terminoContagemLoja: string;
  inicioDivergencia: string;
  terminoDivergencia: string;
  terminoInventario: string;
  avanco22h: string;
  avanco00h: string;
  avanco01h: string;
  avanco03h: string;
  avanco04h: string;
  avancoExtraHora: string; // opcional: incluir novo horário
  avancoExtraValor: string;
  envioArquivo1: string;
  envioArquivo2: string;
  envioArquivo3: string;
  avalEstoque: string;
  avalLoja: string;
  acuracidade: string;
  percentualAuditoria: string;
  ph: string;
  satisfacao: string;
  contagemAntecipada: boolean | null;
}

// ---------------------------------------------------------------------------
// REPORT B — Farmácias
// ---------------------------------------------------------------------------
export interface ReportBFarmacias {
  lojaNum: string;
  lojaNome: string;
  data: string;
  pivProgramado: string;
  pivRealizado: string;
  chegadaEquipe: string;
  inicioDeposito: string;
  terminoDeposito: string;
  inicioLoja: string;
  terminoLoja: string;
  inicioAuditoriaCliente: string;
  terminoAuditoriaCliente: string;
  inicioControlados: string;
  terminoControlados: string;
  inicioDivergencia: string;
  terminoDivergencia: string;
  qtdAlterados: string;
  inicioNaoContados: string;
  terminoNaoContados: string;
  qtdNaoContados: string;
  qtdEncontradosNaoContados: string;
  inicioRecontCliente: string;
  terminoRecontCliente: string;
  qtdItensRecontCliente: string;
  qtdAltRecontCliente: string;
  envioArquivo1: string;
  envioArquivo2: string;
  envioArquivo3: string;
  totalPecas: string;
  valorTotal: string;
  avalPrepDeposito: string;
  avalPrepLoja: string;
  satisfacao: string;
  responsavel: string;
  acuracidadeCliente: string;
  acuracidadeTerceirizada: string;
  suporteSolicitado: boolean | null;
  phCalculado: string;
  terminoInventario: string;
}

// ---------------------------------------------------------------------------
// REPORT B — Mercados (menos Atacado e Hipermercados)
// ---------------------------------------------------------------------------
export interface ReportBMercados {
  lojaNome: string;
  lojaNum: string;
  data: string;
  pivProgramado: string;
  pivRealizado: string;
  chegadaEquipe: string;
  inicioDeposito: string;
  terminoDeposito: string;
  inicioLoja: string;
  terminoLoja: string;
  inicioAuditoriaCliente: string;
  terminoAuditoriaCliente: string;
  inicioDivergencia: string;
  terminoDivergencia: string;
  qtdAlterados: string;
  inicioNaoContados: string;
  qtdNaoContados: string;
  qtdEncontradosNaoContados: string;
  terminoNaoContados: string;
  totalPecas: string;
  valorTotal: string;
  avalPrepDeposito: string;
  avalPrepLoja: string;
  satisfacao: string;
  responsavel: string;
  acuracidadeCliente: string;
  acuracidadeTerceirizada: string;
  suporteSolicitado: boolean | null;
  terminoInventario: string;
}

// ---------------------------------------------------------------------------
// REPORT B — Outros Estabelecimentos em Geral
// ---------------------------------------------------------------------------
export interface ReportBOutros {
  lojaNum: string;
  lojaNome: string;
  data: string;
  responsavel: string;
  qtdPessoas: string;
  chegadaEquipe: string;
  inicioDeposito: string;
  terminoDeposito: string;
  inicioLoja: string;
  terminoLoja: string;
  inicioAuditoriaCliente: string;
  terminoAuditoriaCliente: string;
  inicioDivergencia: string;
  terminoDivergencia: string;
  totalPecas: string;
  valorTotal: string;
  pctInv: string;
  avalEstoque: string;
  avalLoja: string;
  terminoInventario: string;
}

// Union para uso genérico
export type ReportBMode = "farmacias" | "mercados" | "outros";
export type ReportB = ReportBFarmacias | ReportBMercados | ReportBOutros;

// Mantido para compatibilidade com imports existentes no parsers.ts
export interface ReportC { _removed: true; }
export interface ReportD { _removed: true; }

export interface AttendanceCollaborator {
  id: string;
  nome: string;
  numero?: number; // número da escala (ex: 1, 2, 3)
  ehBkp?: boolean; // true se veio de linha "BKP NOME"
  status: "PRESENTE" | "AUSENTE" | "NAO_DEFINIDO";
  substituto?: string;
}

export interface AttendanceData {
  data: string;
  loja: string;
  enderecoLoja: string;
  colaboradores: AttendanceCollaborator[];
}

// ========== INVENTEXP - AVALIAÇÃO DE CONFERENTES ==========

export type CheckerExperienceLevel = "novato" | "junior" | "pleno" | "senior" | "expert";

export interface CheckerDBRecord {
  nome: string;
  inventarios_base: number;
  data_registro: string;
}

export type InventoryOperationType = "FARMACIA" | "SUPERMERCADO" | "LOJA_GERAL";

export interface InventoryCheckerInput {
  nome: string;
  matricula?: string;
  qtde: number;
  qtde1a1: number;
  produtividade: number;
  erro: number;
  experiencia?: CheckerExperienceLevel;
  itensPulados?: number;
  itensDuplicados?: number;
  /** Soma de |Qtd(A1)| por conferente extraída da produtividade_tag */
  erroSecao?: number;
  /** Número de seções físicas que o conferente trabalhou */
  numSecoes?: number;
}

export type InventoryScoreLevel = "EXCELENTE" | "BOM" | "ATENCAO" | "CRITICO";

/** Acurácia de uma seção física da loja para o relatório gerencial */
export interface SectionAccuracyRecord {
  area: string;
  totalC1: number;       // soma Qtd(C1) da seção
  ajusteAbsoluto: number; // soma |Qtd(A1)| da seção
  ajusteLiquido: number; // soma Qtd(A1) com sinal (saldo final)
  acuracidade: number;   // % 0-100
  /** Colaboradores que trabalharam na seção */
  colaboradores: string[];
}

export interface InventoryCheckerEvaluation {
  input: InventoryCheckerInput;
  operationType: InventoryOperationType;
  pctErro: number;
  pctBloco: number;
  scoreQualidade: number;
  scoreProdutividade: number;
  scoreAderencia: number;
  minimoEsperado?: number;
  icv?: number;
  pontosVolume?: number;
  bonusVolume?: number;
  penalidadeVolume?: number;
  /**
   * ICSI — Índice de Consistência Seção vs. Item (0-100%)
   * Alto = erros diretos e identificáveis; Baixo = erros se compensaram nas seções (risco oculto)
   */
  icsi?: number;
  scoreFinal: number;
  nivel: InventoryScoreLevel;
  nivelColor: string;
  tags: string[];
}

// =============================================================================
// BACKEND MODULES — Motor de Escalas
// =============================================================================

// ---------------------------------------------------------------------------
// CLIENTES
// ---------------------------------------------------------------------------
export interface Cliente {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  endereco?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type ClienteInput = Omit<Cliente, 'id' | 'created_at' | 'updated_at'>;

// ---------------------------------------------------------------------------
// COLABORADORES
// ---------------------------------------------------------------------------
export type ColaboradorFuncao = 'LIDER' | 'CONFERENTE';

export interface Colaborador {
  id: string;
  matricula?: string;
  nome: string;
  funcao: ColaboradorFuncao;
  cidade: string;
  estado: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type ColaboradorInput = Omit<Colaborador, 'id' | 'created_at' | 'updated_at'>;

// ---------------------------------------------------------------------------
// HISTÓRICO DE PRODUTIVIDADE
// ---------------------------------------------------------------------------
export interface Produtividade {
  id: string;
  colaborador_id: string;
  inventario_ref?: string;
  data_inventario: string;        // ISO date string
  qtde: number;
  qtde1a1: number;
  produtividade_ph: number;       // itens/hora
  erro: number;
  horas_estimadas?: number;
  operacao_tipo?: InventoryOperationType;
  score_final?: number;
  nivel?: InventoryScoreLevel;
  created_at: string;
}

export type ProdutividadeInput = Omit<Produtividade, 'id' | 'created_at'>;

// ---------------------------------------------------------------------------
// INVENTÁRIOS
// ---------------------------------------------------------------------------
export type InventarioStatus = 'AGENDADO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';

export interface Inventario {
  id: string;
  cliente_id: string;
  data: string;                   // ISO date string
  hora_inicio?: string;
  tipo_operacao: InventoryOperationType;
  headcount: number;
  status: InventarioStatus;
  observacoes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joins opcionais
  clientes?: Pick<Cliente, 'id' | 'nome' | 'cidade' | 'estado'>;
}

export type InventarioInput = Omit<Inventario, 'id' | 'created_at' | 'updated_at' | 'clientes'>;

// ---------------------------------------------------------------------------
// ESCALA
// ---------------------------------------------------------------------------
export type EscalaPapel = 'LIDER' | 'CONFERENTE' | 'RESERVA';

export interface EscalaItem {
  id: string;
  inventario_id: string;
  colaborador_id: string;
  papel: EscalaPapel;
  score_final?: number;
  gerado_em: string;
  confirmado: boolean;
  observacoes?: string;
  // Joins opcionais
  colaboradores?: Pick<Colaborador, 'id' | 'nome' | 'funcao' | 'cidade' | 'matricula'>;
}

// ---------------------------------------------------------------------------
// VIEWS
// ---------------------------------------------------------------------------
export interface ProdutividadeConsolidada {
  colaborador_id: string;
  nome: string;
  funcao: ColaboradorFuncao;
  cidade: string;
  ativo: boolean;
  total_inventarios: number;
  produtividade_media: number;
  erro_medio_pct: number;
  score_base: number;
  ultimo_inventario?: string;
}

// ---------------------------------------------------------------------------
// RESPOSTAS DE RPC
// ---------------------------------------------------------------------------
export interface GerarEscalaResult {
  sucesso: boolean;
  inventario_id: string;
  data: string;
  cliente: string;
  headcount: number;
  total_escalados: number;
  avisos: string[];
}

export interface ListarEscalaRow {
  escala_id: string;
  papel: EscalaPapel;
  score_final: number;
  confirmado: boolean;
  colaborador_id: string;
  nome: string;
  funcao: ColaboradorFuncao;
  cidade: string;
  matricula?: string;
}

/** Resposta padronizada para operações de CRUD em todos os módulos */
export interface ICrudResult<T = void> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ---------------------------------------------------------------------------
// ERROS DE NEGÓCIO
// ---------------------------------------------------------------------------
export class EscalaInsuficienteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EscalaInsuficienteError';
  }
}

``n

## Arquivo: src\config\inventoryEvalConfig.ts
`	ypescript
export const INVENTORY_PROFILES = {
  FARMACIA: {
    weights: { quality: 0.55, productivity: 0.20, adherence: 0.15, volume: 0.10 },
    targets: {
      productivity: 800,
      maxBlockLimit: 20,
      erroTolerancia: 0.35,
      erroCritico: 0.8,
    },
    alerts: { criticalBlockLimit: 50 },
    /**
     * Fator de decaimento da curva de qualidade (k).
     * Fórmula: scoreQualidade = 100 * e^(-k * pctErro)
     * Farmácia: alta sensibilidade a erros (medicamentos = risco de saúde)
     * k=1.5 → 1% erro ≈ 78 pts | 2% erro ≈ 50 pts | 5% erro ≈ 5 pts
     */
    qualityDecayRate: 1.5,
  },
  SUPERMERCADO: {
    weights: { quality: 0.45, productivity: 0.35, adherence: 0.10, volume: 0.10 },
    targets: {
      productivity: 1200,
      maxBlockLimit: 50,
      erroTolerancia: 1.0,
      erroCritico: 2.0,
    },
    alerts: { criticalBlockLimit: 80 },
    /**
     * Supermercado: tolerância maior (produtos embalados, menor risco unitário)
     * k=0.8 → 1% erro ≈ 92 pts | 2% erro ≈ 85 pts | 5% erro ≈ 67 pts
     */
    qualityDecayRate: 0.8,
  },
  LOJA_GERAL: {
    weights: { quality: 0.5, productivity: 0.25, adherence: 0.15, volume: 0.10 },
    targets: {
      productivity: 1000,
      maxBlockLimit: 35,
      erroTolerancia: 0.8,
      erroCritico: 1.5,
    },
    alerts: { criticalBlockLimit: 65 },
    /**
     * Loja geral: sensibilidade intermediária
     * k=1.1 → 1% erro ≈ 89 pts | 2% erro ≈ 80 pts | 5% erro ≈ 58 pts
     */
    qualityDecayRate: 1.1,
  },
} as const;

export type InventoryOperationType = keyof typeof INVENTORY_PROFILES;


``n

## Arquivo: src\services\InventoryEvaluationService.ts
`	ypescript
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

``n

## Arquivo: src\utils\parsers.ts
`	ypescript
import type {
  AttendanceCollaborator,
  AttendanceData,
  InventoryCheckerInput,
  ReportA,
  ReportBFarmacias,
  ReportBMercados,
  ReportBOutros,
} from "../types";

// ==========================
// FORMATAÇÃO GERAL
// ==========================
const parseNum = (s: string | number): number => {
  const v = String(s ?? "").replace(/%/g, "").trim();
  if (!v) return 0;
  if (v.includes(",")) return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
  return parseFloat(v) || 0;
};

const fmtTime = (val: string) => (!val ? "" : `*${val.replace(":", "h")}*`);
const fmtIntBr = (val: string | number | "") =>
  val === "" ? "" : `*${parseNum(val).toLocaleString("pt-BR")}*`;
const fmtPct = (val: string | number | "") =>
  val === "" ? "" : `*${parseNum(val).toFixed(2).replace(".", ",")}%*`;
const fmtMoeda = (val: string | number | "") =>
  val === ""
    ? ""
    : `*R$ ${parseNum(val)
        .toFixed(2)
        .replace(".", ",")
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}*`;
const fmtVal = (val: string | number | boolean | null | undefined) => (!val && val !== 0 ? "" : `*${val}*`);
const fmtBool = (val: boolean | null) =>
  val === true ? "*Sim*" : val === false ? "*Não*" : "*N/A*";

// ==========================
// PARSER DE ESCALA (NOVA LÓGICA RÍGIDA)
// ==========================
export const parseWhatsAppScale = (text: string): AttendanceData => {
  // Remove linhas vazias e espaços extras
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Regra Estrita:
  // Linha 0 -> Data
  // Linha 1 -> Loja
  // Linha 2 -> Endereço
  const dataRaw = lines[0] || "";
  const lojaRaw = lines[1] || "";
  const enderecoRaw = lines[2] || "";

  const nomes: AttendanceCollaborator[] = [];

  // Linhas 3+: número + nome (ex: "1 GABRIEL...") ou BKP + nome (ex: "BKP NICOLAS NASCIMENTO")
  lines.forEach((line, index) => {
    if (index < 3) return;

    const matchNum = line.match(/^(\d+)[\s.-]*(.*)/);
    if (matchNum && matchNum[2]?.trim()) {
      const num = parseInt(matchNum[1], 10);
      const cleanName = matchNum[2].trim().replace(/\s*[✅❌]\s*$/, "").trim();
      if (cleanName.length > 2) {
        nomes.push({
          id: Date.now().toString() + Math.random().toString(),
          nome: cleanName,
          numero: num,
          ehBkp: false,
          status: "NAO_DEFINIDO",
          substituto: "",
        });
      }
      return;
    }

    const matchBkp = line.match(/^BKP\s+(.+)/i);
    if (matchBkp && matchBkp[1]?.trim()) {
      const cleanName = matchBkp[1].trim().replace(/\s*[✅❌]\s*$/, "").trim();
      if (cleanName.length > 2) {
        nomes.push({
          id: Date.now().toString() + Math.random().toString(),
          nome: cleanName,
          ehBkp: true,
          status: "NAO_DEFINIDO",
          substituto: "",
        });
      }
    }
  });

  return {
    data: dataRaw,
    loja: lojaRaw,
    enderecoLoja: enderecoRaw,
    colaboradores: nomes,
  };
};

export const formatDateInput = (text: string) => {
  let v = text.replace(/\D/g, "");
  if (v.length > 8) v = v.slice(0, 8);
  if (v.length > 4) return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
  if (v.length > 2) return `${v.slice(0, 2)}/${v.slice(2)}`;
  return v;
};

export const formatTimeInput = (text: string): string => {
  let clean = text.replace(/\D/g, "");
  if (clean.length > 4) {
    clean = clean.slice(0, 4);
  }
  if (clean.length > 2) {
    return `${clean.slice(0, 2)}:${clean.slice(2)}`;
  }
  return clean;
};

export const formatTimeNow = (): string => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
};


export const formatAttendanceMessage = (data: AttendanceData): string => {
  const icon = (c: AttendanceCollaborator) =>
    c.status === "PRESENTE" ? " ✅" : c.status === "AUSENTE" ? " ❌" : "";
  const linhas: string[] = [];
  let currentNum = 1;
  for (let i = 0; i < data.colaboradores.length; i++) {
    const c = data.colaboradores[i];
    const num = c.numero ?? currentNum;
    currentNum = num + 1;
    
    const sub = (c.substituto ?? "").trim();
    if (sub) {
      linhas.push(`${num} ${c.nome} ❌`);
      linhas.push(`${sub} (substituição) ✅`);
    } else {
      linhas.push(`${num} ${c.nome}${icon(c)}`);
    }
  }
  return (
    `${data.data}\n` +
    `${data.loja || "N/A"}\n` +
    `${data.enderecoLoja || "N/A"}\n\n` +
    linhas.join("\n")
  );
};

// Converte "HH:MM" para minutos para comparação
const timeToMinutes = (t: string): number => {
  if (!t) return Infinity;
  const [h, m] = t.split(":").map(Number);
  const mins = (h ?? 0) * 60 + (m ?? 0);
  // Horários de 0-17h são tratados como dia seguinte (pós-meia-noite)
  return (h ?? 0) < 18 ? mins + 1440 : mins;
};

export const formatReportA = (r: ReportA): string => {
  // Monta os avanços padrão como pares [hora_str, minutos, valor]
  const avancos: { label: string; mins: number; val: string | number | "" }[] = [
    { label: "22h00", mins: timeToMinutes("22:00"), val: r.avanco22h },
    { label: "00h00", mins: timeToMinutes("00:00"), val: r.avanco00h },
    { label: "01h00", mins: timeToMinutes("01:00"), val: r.avanco01h },
    { label: "03h00", mins: timeToMinutes("03:00"), val: r.avanco03h },
    { label: "04h00", mins: timeToMinutes("04:00"), val: r.avanco04h },
  ];
  if (r.avancoExtraHora && r.avancoExtraValor !== "") {
    avancos.push({
      label: r.avancoExtraHora.replace(":", "h"),
      mins: timeToMinutes(r.avancoExtraHora),
      val: r.avancoExtraValor,
    });
  }
  avancos.sort((a, b) => a.mins - b.mins);
  const blocoAvancos = avancos
    .map((a) => `Avanço ${a.label}: ${fmtPct(a.val)}`)
    .join("\n");

  return `*ACOMPANHAMENTO DE INVENTÁRIO*

Nº Loja: ${fmtVal(r.lojaNum)}
Loja: ${fmtVal(r.lojaNome)}
Qtd. Colab.: ${fmtVal(r.qtdColaboradores)}
Líder: ${fmtVal(r.lider)}
Chegada: ${fmtTime(r.hrChegada)}
Ini. Cont. Est.: ${fmtTime(r.inicioContagemEstoque)}
Fim Cont. Est.: ${fmtTime(r.terminoContagemEstoque)}
Ini. Cont. Loja: ${fmtTime(r.inicioContagemLoja)}
Fim Cont. Loja: ${fmtTime(r.terminoContagemLoja)}
${blocoAvancos}
Ini. Diverg.: ${fmtTime(r.inicioDivergencia)}
Fim Diverg.: ${fmtTime(r.terminoDivergencia)}
Aval. Estoque: ${fmtPct(r.avalEstoque)}
Aval. Loja: ${fmtPct(r.avalLoja)}
Envio 1º Arq.: ${fmtTime(r.envioArquivo1)}
Envio 2º Arq.: ${fmtTime(r.envioArquivo2)}
Envio 3º Arq.: ${fmtTime(r.envioArquivo3)}
Cont. Antecipada: ${fmtBool(r.contagemAntecipada)}
Satisfação: ${fmtVal(r.satisfacao)}
Acuracidade: ${fmtPct(r.acuracidade)}
% Auditoria: ${fmtPct(r.percentualAuditoria)}
Produtividade (PH): ${fmtIntBr(r.ph)}
Fim Inventário: ${fmtTime(r.terminoInventario)}`;
};

export const formatReportBFarmacias = (r: ReportBFarmacias): string => {
  return `*RESUMO FINAL DO INVENTÁRIO — FARMÁCIA*

Nº Loja: ${fmtVal(r.lojaNum)}
Loja: ${fmtVal(r.lojaNome)}
Data: ${fmtVal(r.data)}
PIV Prog.: ${fmtVal(r.pivProgramado)}
PIV Real.: ${fmtVal(r.pivRealizado)}
Chegada Equipe: ${fmtTime(r.chegadaEquipe)}
Ini. Cont. Dep.: ${fmtTime(r.inicioDeposito)}
Fim Cont. Dep.: ${fmtTime(r.terminoDeposito)}
Ini. Cont. Loja: ${fmtTime(r.inicioLoja)}
Fim Cont. Loja: ${fmtTime(r.terminoLoja)}
Ini. Audit. Cli.: ${fmtTime(r.inicioAuditoriaCliente)}
Fim Audit. Cli.: ${fmtTime(r.terminoAuditoriaCliente)}
Ini. Diverg. Ctrl.: ${fmtTime(r.inicioControlados)}
Fim Diverg. Ctrl.: ${fmtTime(r.terminoControlados)}
Ini. Diverg.: ${fmtTime(r.inicioDivergencia)}
Fim Diverg.: ${fmtTime(r.terminoDivergencia)}
Itens Alt. Diverg.: ${fmtVal(r.qtdAlterados)}
Ini. N. Cont.: ${fmtTime(r.inicioNaoContados)}
Fim N. Cont.: ${fmtTime(r.terminoNaoContados)}
Itens N. Cont.: ${fmtVal(r.qtdNaoContados)}
Enc. no N. Cont.: ${fmtVal(r.qtdEncontradosNaoContados)}
Ini. Recont. Cli.: ${fmtTime(r.inicioRecontCliente)}
Fim Recont. Cli.: ${fmtTime(r.terminoRecontCliente)}
Qtd. Itens Recont. Cli.: ${fmtVal(r.qtdItensRecontCliente)}
Qtd. Alt. Recont. Cli.: ${fmtVal(r.qtdAltRecontCliente)}
Envio 1º Arq.: ${fmtTime(r.envioArquivo1)}
Envio 2º Arq.: ${fmtTime(r.envioArquivo2)}
Envio 3º Arq.: ${fmtTime(r.envioArquivo3)}
Total Peças: ${fmtIntBr(r.totalPecas)}
Valor Total: ${fmtMoeda(r.valorTotal)}
Aval. Prep. Dep.: ${fmtPct(r.avalPrepDeposito)}
Aval. Prep. Loja: ${fmtPct(r.avalPrepLoja)}
Satisfação: ${fmtVal(r.satisfacao)}
Responsável: ${fmtVal(r.responsavel)}
Acur. Cli.: ${fmtPct(r.acuracidadeCliente)}
Acur. Terc.: ${fmtPct(r.acuracidadeTerceirizada)}
Houve Suporte?: ${fmtBool(r.suporteSolicitado)}
PH Calc.: ${fmtIntBr(r.phCalculado)}
Fim Inventário: ${fmtTime(r.terminoInventario)}`;
};

export const formatReportBMercados = (r: ReportBMercados): string => {
  return `*RESUMO FINAL DO INVENTÁRIO — MERCADO*

Loja: ${fmtVal(r.lojaNome)}
Nº Loja: ${fmtVal(r.lojaNum)}
Data: ${fmtVal(r.data)}
PIV Prog.: ${fmtVal(r.pivProgramado)}
PIV Real.: ${fmtVal(r.pivRealizado)}
Chegada Equipe: ${fmtTime(r.chegadaEquipe)}
Ini. Cont. Dep.: ${fmtTime(r.inicioDeposito)}
Fim Cont. Dep.: ${fmtTime(r.terminoDeposito)}
Ini. Cont. Loja: ${fmtTime(r.inicioLoja)}
Fim Cont. Loja: ${fmtTime(r.terminoLoja)}
Ini. Audit. Cli.: ${fmtTime(r.inicioAuditoriaCliente)}
Fim Audit. Cli.: ${fmtTime(r.terminoAuditoriaCliente)}
Ini. Diverg.: ${fmtTime(r.inicioDivergencia)}
Fim Diverg.: ${fmtTime(r.terminoDivergencia)}
Itens Alt. Diverg.: ${fmtVal(r.qtdAlterados)}
Ini. N. Cont.: ${fmtTime(r.inicioNaoContados)}
Itens N. Cont.: ${fmtVal(r.qtdNaoContados)}
Enc. no N. Cont.: ${fmtVal(r.qtdEncontradosNaoContados)}
Fim N. Cont.: ${fmtTime(r.terminoNaoContados)}
Total Peças: ${fmtIntBr(r.totalPecas)}
Valor Total: ${fmtMoeda(r.valorTotal)}
Aval. Prep. Dep.: ${fmtPct(r.avalPrepDeposito)}
Aval. Prep. Loja: ${fmtPct(r.avalPrepLoja)}
Satisfação: ${fmtVal(r.satisfacao)}
Responsável: ${fmtVal(r.responsavel)}
Acur. Cli.: ${fmtPct(r.acuracidadeCliente)}
Acur. Terc.: ${fmtPct(r.acuracidadeTerceirizada)}
Houve Suporte?: ${fmtBool(r.suporteSolicitado)}
Fim Inventário: ${fmtTime(r.terminoInventario)}`;
};

export const formatReportBOutros = (r: ReportBOutros): string => {
  return `*RESUMO FINAL DO INVENTÁRIO*

Nº Loja: ${fmtVal(r.lojaNum)}
Loja: ${fmtVal(r.lojaNome)}
Data: ${fmtVal(r.data)}
Responsável: ${fmtVal(r.responsavel)}
Qtd. Pessoas: ${fmtVal(r.qtdPessoas)}
Chegada Equipe: ${fmtTime(r.chegadaEquipe)}
Ini. Cont. Dep.: ${fmtTime(r.inicioDeposito)}
Fim Cont. Dep.: ${fmtTime(r.terminoDeposito)}
Ini. Cont. Loja: ${fmtTime(r.inicioLoja)}
Fim Cont. Loja: ${fmtTime(r.terminoLoja)}
Ini. Audit. Cli.: ${fmtTime(r.inicioAuditoriaCliente)}
Fim Audit. Cli.: ${fmtTime(r.terminoAuditoriaCliente)}
Ini. Diverg.: ${fmtTime(r.inicioDivergencia)}
Fim Diverg.: ${fmtTime(r.terminoDivergencia)}
Total Peças: ${fmtIntBr(r.totalPecas)}
Valor Total: ${fmtMoeda(r.valorTotal)}
% Inv.: ${fmtPct(r.pctInv)}
Aval. Est.: ${fmtPct(r.avalEstoque)}
Aval. Loja: ${fmtPct(r.avalLoja)}
Fim Inventário: ${fmtTime(r.terminoInventario)}`;
};

// Aliases mantidos para não quebrar imports de arquivos antigos
/** @deprecated use formatReportBFarmacias */
export const formatReportB = formatReportBFarmacias as unknown as (r: never) => string;
/** @deprecated ReportC removido */
export const formatReportC = (_r: unknown): string => "";
/** @deprecated ReportD removido */
export const formatReportD = (_r: unknown): string => "";

// Número: BR 7.307,00 -> 7307 | 0,027 -> 0.027; US 1,770.65 -> 1770.65
// Também lida com strings de percentagem "1,73%" -> 1.73
const parseNumberBR = (s: string): number => {
  const v = String(s ?? "").replace(/%/g, "").trim();
  if (!v) return 0;
  
  // Detectar formato US exportado pelo XLSX (vírgula antes de ponto): "1,770.65"
  const commaIdx = v.indexOf(",");
  const dotIdx = v.indexOf(".");
  if (commaIdx !== -1 && dotIdx !== -1) {
    if (commaIdx < dotIdx) {
      // US format: remove commas
      return parseFloat(v.replace(/,/g, "")) || 0;
    } else {
      // BR format: remove dots, replace comma with dot
      return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
    }
  }
  
  // Apenas vírgula: "395,33" (BR) ou "5,647" (US thousand?)
  // Se termina com exatos 3 dígitos após a vírgula, e tem formato de milhar, pode ser US.
  // Mas no Brasil, usamos vírgula como decimal na maioria dos textos colados.
  if (v.includes(",")) {
    // Se for "5,647.00" já caiu no if acima. Se for "6,817", é BR decimal "6.817" ou US "6817"?
    // Vamos assumir que vírgula sozinha é BR decimal, a não ser que tenha exatos 3 digitos.
    if (/,\d{3}$/.test(v) && !/,\d{2}$/.test(v)) {
      // Provável US thousand (ex: 5,647)
      return parseFloat(v.replace(/,/g, "")) || 0;
    }
    // BR decimal
    return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
  }
  
  return parseFloat(v) || 0;
};

// ==========================
// PARSER INVENTEXP - CONFERENTES (CSV/Excel)
// ==========================
/**
 * Parser robusto para o formato real exportado pelo sistema cliente.
 *
 * Formato suportado (separador ; , ou tab, números BR):
 *   NOME DO CONFERENTE;PRODUTIVIDADE;QTDE. VOLUMES;1a1;BLOCO;HORAS ESTIMADAS;ERRO;% ERRO
 *   AMANDA DE OLIVEIRA;395,33;752;0;18;1,9;13;1,73%
 *
 * Também aceita o formato simplificado:
 *   Nome,Qtde,Qtde1a1,Produtividade,Erro
 *
 * Lógica:
 *  - qtde   → coluna "QTDE. VOLUMES" ou "Qtde"
 *  - qtde1a1 → coluna "1a1"
 *  - produtividade → coluna "PRODUTIVIDADE"
 *  - erro   → coluna "ERRO" (quantidade absoluta, não percentagem)
 *
 * Nota: o pctBloco é REcalculado pelo sistema como (qtde - qtde1a1) / qtde,
 * ignorando a coluna "BLOCO" e "% ERRO" do CSV (usadas apenas para auditoria).
 */
export const parseInventoryCheckersCsv = (
  text: string,
): InventoryCheckerInput[] => {
  const lines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  // Detecta o separador dominante numa linha
  const detectSeparator = (line: string): RegExp => {
    const semicolons = (line.match(/;/g) ?? []).length;
    const tabs       = (line.match(/\t/g) ?? []).length;
    const commas     = (line.match(/,/g) ?? []).length;
    if (semicolons >= tabs && semicolons >= commas) return /;/;
    if (tabs >= commas) return /\t/;
    return /,/;
  };

  const parseRow = (row: string, sep: RegExp): string[] => {
    if (!row.includes('"')) {
      return row.split(sep).map((c) => c.trim());
    }
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') { inQuotes = !inQuotes; continue; }
      if (sep.test(c) && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    result.push(current.trim());
    return result;
  };

  const normalizeHeader = (h: string): string =>
    h.replace(/^"|"$/g, "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");


  let headerRowIndex = -1;
  let sep = /,/;
  let col = { nome: -1, qtde: -1, qtde1a1: -1, produtividade: -1, erro: -1 };

  // Scan the first 30 lines to find the header row
  for (let r = 0; r < Math.min(lines.length, 30); r++) {
    sep = detectSeparator(lines[r]);
    const rawHeader = parseRow(lines[r], sep);
    const header = rawHeader.map(normalizeHeader);

    const matchCol = (patterns: RegExp[], exclude?: RegExp): number => {
      return header.findIndex((h) => {
        if (exclude && exclude.test(h)) return false;
        return patterns.some((p) => p.test(h));
      });
    };

    const cNome = matchCol([/nome/i, /conferente/i, /colaborador/i]);
    const cQtde = matchCol([/^qtde\.?\s*volu/i, /^qtde/i, /^quantidade/i, /^qtd/i, /total.*peca/i, /volumes/i], /1a1|unit/i);
    const cQtde1a1 = matchCol([/1\s*a\s*1/i, /1a1/i, /qtde1a1/i, /unit[aá]rio/i, /unit/i]);
    // Produtividade: evitar "horas trabalhadas" ou "estimadas"
    const cProdutividade = matchCol([/produtividade/i, /ritmo/i, /itens.*hora/i, /prod.*hora/i]);
    // Erro: erro absoluto
    const cErro = matchCol([/^erro/i, /^erros/i, /^qtde.*erro/i, /divergencia/i], /%/); 
    const cPctErro = matchCol([/%/i, /taxa.*erro/i]); 

    // Diagnóstico flexível: tenta encontrar pelo menos Nome e Quantidade
    if (cNome >= 0 && cQtde >= 0) {
      col = { 
        nome: cNome, 
        qtde: cQtde, 
        qtde1a1: cQtde1a1 >= 0 && cQtde1a1 !== cQtde ? cQtde1a1 : -1, 
        produtividade: cProdutividade >= 0 && cProdutividade !== cQtde ? cProdutividade : -1, 
        erro: cErro >= 0 ? cErro : cPctErro 
      };

      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex < 0) {
    return [];
  }

  const result: InventoryCheckerInput[] = [];

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const cells = parseRow(lines[i], sep).map((c) =>
      (c ?? "").replace(/^"|"$/g, "").trim(),
    );

    // HEURÍSTICA DIRETA PARA O EXCEL DO CLIENTE:
    // Evita o problema de colunas desalinhadas (merged cells) no Excel.
    const nonEmpties = cells.filter(c => c !== "");
    if (nonEmpties.length >= 10 && /^\d+$/.test(nonEmpties[0]) && /^\d+$/.test(nonEmpties[1]) && /\d{2}\/\d{2}\/\d{4}/.test(nonEmpties[4])) {
      const nome = nonEmpties[2];
      if (/^(nome|total|soma|media|resumo)/i.test(nome)) continue;
      
      const qtde = parseNumberBR(nonEmpties[3]);
      const produtividade = parseNumberBR(nonEmpties[7]);
      const erro = parseNumberBR(nonEmpties[8]);
      const qtde1a1 = nonEmpties.length > 13 ? parseNumberBR(nonEmpties[13]) : 0;

      result.push({
        nome,
        qtde: Math.max(0, qtde),
        qtde1a1: Math.max(0, qtde1a1),
        produtividade: Math.max(0, produtividade),
        erro: Math.max(0, erro),
      });
      continue;
    }

    // FALLBACK ORIGINAL (Para CSVs normais ou colados à mão)
    const nome = (cells[col.nome] ?? "").trim();
    if (!nome) continue;
    if (/^(nome|total|soma|media|resumo)/i.test(nome)) continue;

    const qtde = parseNumberBR(cells[col.qtde] ?? "");
    const qtde1a1Raw = col.qtde1a1 >= 0 ? parseNumberBR(cells[col.qtde1a1] ?? "") : 0;
    const qtde1a1 = Math.max(0, qtde1a1Raw);
    const produtividade = col.produtividade >= 0 ? parseNumberBR(cells[col.produtividade] ?? "") : 0;
    let erro = 0;
    if (col.erro >= 0) {
      const rawErro = cells[col.erro] ?? "";
      const valErro = parseNumberBR(rawErro);
      // Se a coluna lida for a de porcentagem (ex: 1,73%), precisamos calcular o valor absoluto
      if (rawErro.includes('%') || valErro < 5) { // heurística: se erro for um número muito baixo com casas decimais
        // É provável que seja um percentual, então calculamos: qtde * (valErro / 100)
        // A menos que não tenha o sinal de %, aí usamos o valErro como absoluto (pode ser 1 ou 2)
        if (rawErro.includes('%')) {
          erro = Math.round(qtde * (valErro / 100));
        } else {
          erro = valErro;
        }
      } else {
        erro = valErro;
      }
    }
    
    erro = Math.max(0, erro);

    if (qtde <= 0) continue;

    result.push({
      nome,
      qtde,
      qtde1a1: Math.min(qtde1a1, qtde),
      produtividade,
      erro: Math.min(erro, qtde),
    });
  }

  return result;
};

// ==========================
// PARSER INVENTEXP - TAGS (CSV/Excel) — Formato simples (backward-compat)
// ==========================
export const parseTagsCsv = (
  text: string,
): Record<string, { itensPulados: number; itensDuplicados: number }> => {
  const result: Record<string, { itensPulados: number; itensDuplicados: number }> = {};
  
  const lines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
    
  if (lines.length < 2) return result;

  const detectSeparator = (line: string): RegExp => {
    const semicolons = (line.match(/;/g) ?? []).length;
    const tabs       = (line.match(/\t/g) ?? []).length;
    const commas     = (line.match(/,/g) ?? []).length;
    if (semicolons >= tabs && semicolons >= commas) return /;/;
    if (tabs >= commas) return /\t/;
    return /,/;
  };

  const parseRow = (row: string, sep: RegExp): string[] => {
    if (!row.includes('"')) {
      return row.split(sep).map((c) => c.trim());
    }
    const res: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') { inQuotes = !inQuotes; continue; }
      if (sep.test(c) && !inQuotes) {
        res.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    res.push(current.trim());
    return res;
  };

  const normalizeHeader = (h: string): string =>
    h.replace(/^"|"$/g, "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  let headerRowIndex = -1;
  let sep = /,/;
  let col = { nome: -1, qtdA1: -1 };

  for (let r = 0; r < Math.min(lines.length, 30); r++) {
    sep = detectSeparator(lines[r]);
    const header = parseRow(lines[r], sep).map(normalizeHeader);

    const cNome = header.findIndex((h) => /nome|conferente|colaborador/i.test(h));
    const cQtdA1 = header.findIndex((h) => /qtd.*a1/i.test(h));

    if (cNome >= 0 && cQtdA1 >= 0) {
      col = { nome: cNome, qtdA1: cQtdA1 };
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex < 0) return result;

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const cells = parseRow(lines[i], sep).map((c) =>
      (c ?? "").replace(/^"|"$/g, "").trim(),
    );

    const nomeRaw = (cells[col.nome] ?? "").trim();
    if (!nomeRaw || /^(nome|total|soma|media|resumo)/i.test(nomeRaw)) continue;
    
    // Simplificar o nome para facilitar o matching
    const nomeKey = nomeRaw.toLowerCase().trim();
    
    const qtdStr = cells[col.qtdA1] ?? "0";
    const qtdA1 = parseNumberBR(qtdStr); // parseNumberBR suporta virgula decimal e negativo

    if (!result[nomeKey]) {
      result[nomeKey] = { itensPulados: 0, itensDuplicados: 0 };
    }

    if (qtdA1 > 0) {
      result[nomeKey].itensPulados += qtdA1;
    } else if (qtdA1 < 0) {
      result[nomeKey].itensDuplicados += Math.abs(qtdA1);
    }
  }

  return result;
};

// ==========================
// PARSER AVANÇADO - PRODUTIVIDADE_TAG (Formato completo: AREA + MATRICULA + NOME + C1 + A1 ...)
// ==========================
export interface TagsExtendedResult {
  /** Por colaborador: erroSecao = Σ|Qtd(A1)|, numSecoes */
  porColaborador: Record<string, {
    erroSecao: number;
    numSecoes: number;
    itensPulados: number;
    itensDuplicados: number;
    matricula?: string;
  }>;
  /** Por área física: acurácia de estoque */
  porArea: Array<{
    area: string;
    totalC1: number;
    ajusteAbsoluto: number;
    ajusteLiquido: number;
    acuracidade: number;
    colaboradores: string[];
  }>;
  /** Flag indicando se o formato estendido foi detectado */
  isExtended: boolean;
}

/**
 * Parser avançado para o formato completo do relatório RProInv_Produtividade.
 * Suporta o formato exportado com colunas: AREA | MATRICULA | NOME | Seções | Qtd(C1) | Qtd(A1) | Qtd(A2) | Qtd(A3) | QTD(FINAL)
 * Também aceita o formato simples Nome;Qtd(A1) (backward-compat).
 *
 * Calcula:
 *  - erroSecao por conferente = Σ|Qtd(A1)| (erros modulares por seção)
 *  - acurácia por área = 1 - (Σ|Qtd(A1)| / Σ Qtd(C1)) * 100
 */
export const parseTagsExtended = (text: string): TagsExtendedResult => {
  const lines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const emptyResult: TagsExtendedResult = {
    porColaborador: {},
    porArea: [],
    isExtended: false,
  };

  if (lines.length < 2) return emptyResult;

  const detectSeparator = (line: string): RegExp => {
    const tabs = (line.match(/\t/g) ?? []).length;
    const semi = (line.match(/;/g) ?? []).length;
    const commas = (line.match(/,/g) ?? []).length;
    if (tabs >= semi && tabs >= commas) return /\t/;
    if (semi >= commas) return /;/;
    return /,/;
  };

  const parseRow = (row: string, sep: RegExp): string[] =>
    row.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());

  const normalizeH = (h: string): string =>
    h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

  const parseBR = (s: string): number => {
    const v = String(s ?? "").replace(/%/g, "").replace(/\s/g, "").trim();
    if (!v) return 0;
    if (v.includes(",")) {
      return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return parseFloat(v) || 0;
  };

  // Procura header do formato estendido (AREA, NOME, Qtd(C1), Qtd(A1))
  let headerIdx = -1;
  let sep = /\t/;
  let cArea = -1, cMatricula = -1, cNome = -1, cSecoes = -1, cC1 = -1, cA1 = -1;

  for (let r = 0; r < Math.min(lines.length, 20); r++) {
    sep = detectSeparator(lines[r]);
    const raw = parseRow(lines[r], sep);
    const hdr = raw.map(normalizeH);

    const iArea     = hdr.findIndex(h => /^area$/.test(h));
    const iNome     = hdr.findIndex(h => /^nome$/.test(h));
    const iC1       = hdr.findIndex(h => /qtd.*c1/i.test(h));
    const iA1       = hdr.findIndex(h => /qtd.*a1/i.test(h));
    const iMatr     = hdr.findIndex(h => /matricula/i.test(h));
    const iSecoes   = hdr.findIndex(h => /sec[oa]es\s*contadas|secoes/i.test(h));

    if (iArea >= 0 && iNome >= 0 && iC1 >= 0 && iA1 >= 0) {
      cArea = iArea; cNome = iNome; cC1 = iC1; cA1 = iA1;
      cMatricula = iMatr; cSecoes = iSecoes;
      headerIdx = r;
      break;
    }
  }

  // Formato estendido não detectado → tenta formato simples
  if (headerIdx < 0) {
    const simple = parseTagsCsv(text);
    const por: TagsExtendedResult["porColaborador"] = {};
    for (const [k, v] of Object.entries(simple)) {
      por[k] = { erroSecao: 0, numSecoes: 0, ...v };
    }
    return { porColaborador: por, porArea: [], isExtended: false };
  }

  // Estruturas de acumulação
  const colabMap: Record<string, {
    erroSecao: number; numSecoes: number;
    itensPulados: number; itensDuplicados: number; matricula?: string;
  }> = {};
  const areaMap: Record<string, {
    totalC1: number; ajusteAbsoluto: number; ajusteLiquido: number; colaboradores: Set<string>;
  }> = {};

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = parseRow(lines[i], sep);

    const area  = (cells[cArea] ?? "").trim();
    const nome  = (cells[cNome] ?? "").trim();
    const c1Raw = cells[cC1] ?? "";
    const a1Raw = cells[cA1] ?? "";

    // Pula linhas de total/subtotal (sem nome ou sem área), cabeçalhos repetidos e linhas de página
    if (!area || !nome) continue;
    if (/^(area|nome|total|page|rproinv|relat)/i.test(area)) continue;
    if (/^(nome|total|soma|media|page)/i.test(nome)) continue;

    const c1 = parseBR(c1Raw);
    const a1 = parseBR(a1Raw);
    const secoes = cSecoes >= 0 ? (parseBR(cells[cSecoes] ?? "0") || 1) : 1;
    const matricula = cMatricula >= 0 ? (cells[cMatricula] ?? "").trim() || undefined : undefined;

    if (c1 <= 0 && a1 === 0) continue; // linha de subtotal sem dados reais

    // Acumula por colaborador (chave normalizada = lowercase)
    const nomeKey = nome.toLowerCase().trim();
    if (!colabMap[nomeKey]) {
      colabMap[nomeKey] = { erroSecao: 0, numSecoes: 0, itensPulados: 0, itensDuplicados: 0, matricula };
    }
    colabMap[nomeKey].erroSecao += Math.abs(a1);
    colabMap[nomeKey].numSecoes += secoes;
    if (a1 > 0) colabMap[nomeKey].itensPulados += a1;
    else if (a1 < 0) colabMap[nomeKey].itensDuplicados += Math.abs(a1);

    // Acumula por área (apenas linhas com nome de colaborador, não subtotais)
    const areaKey = area.toUpperCase().trim();
    if (!areaMap[areaKey]) {
      areaMap[areaKey] = { totalC1: 0, ajusteAbsoluto: 0, ajusteLiquido: 0, colaboradores: new Set() };
    }
    areaMap[areaKey].totalC1 += c1;
    areaMap[areaKey].ajusteAbsoluto += Math.abs(a1);
    areaMap[areaKey].ajusteLiquido += a1;
    areaMap[areaKey].colaboradores.add(nome);
  }

  // Monta array de acurácia por área, ordenado do pior para o melhor
  const porArea = Object.entries(areaMap)
    .map(([area, d]) => ({
      area,
      totalC1: d.totalC1,
      ajusteAbsoluto: d.ajusteAbsoluto,
      ajusteLiquido: d.ajusteLiquido,
      acuracidade: d.totalC1 > 0
        ? Math.max(0, Math.min(100, (1 - d.ajusteAbsoluto / d.totalC1) * 100))
        : 100,
      colaboradores: Array.from(d.colaboradores),
    }))
    .sort((a, b) => a.acuracidade - b.acuracidade);

  return { porColaborador: colabMap, porArea, isExtended: true };
};

``n

## Arquivo: src\utils\inventExpReports.ts
`	ypescript
import { INVENTORY_PROFILES } from "../config/inventoryEvalConfig";
import type {
    InventoryCheckerEvaluation,
    InventoryOperationType,
    SectionAccuracyRecord,
} from "../types";


export function generateInventExpGerencialReportText(
  operationType: InventoryOperationType,
  evaluations: InventoryCheckerEvaluation[],
  resumo: {
    totalConferentes: number;
    totalItens: number;
    taxaMediaErro: number;
    produtividadeMedia: number;
    scoreMedio: number;
  },
  dataInventario?: string,
  sectionAccuracy?: SectionAccuracyRecord[],
): string {
  const data = dataInventario ?? new Date().toLocaleDateString("pt-BR");
  const perfil = INVENTORY_PROFILES[operationType];
  const top5 = evaluations.slice(0, 5);
  const bottom5 = evaluations.slice(-5).reverse();

  const risco = evaluations.filter(
    (e) =>
      e.nivel === "CRITICO" ||
      e.tags.includes("🚨 Risco de Contagem Superficial"),
  );

  let r = "";
  r += `# RELATÓRIO GERENCIAL - Avaliação\n`;
  r += `## Operação: ${operationType}\n`;
  r += `## Data: ${data}\n\n`;
  r += `---\n\n`;

  r += `## 1. RESUMO EXECUTIVO\n\n`;
  r += `| Indicador | Valor |\n`;
  r += `|-----------|-------|\n`;
  r += `| Total de conferentes | ${resumo.totalConferentes} |\n`;
  r += `| Total de itens contados | ${resumo.totalItens} |\n`;
  r += `| Taxa média de erro | ${resumo.taxaMediaErro}% |\n`;
  r += `| Produtividade média | ${resumo.produtividadeMedia} itens/h |\n`;
  r += `| Score médio | ${resumo.scoreMedio} |\n`;
  r += `| Meta de produtividade | ${perfil.targets.productivity} itens/h |\n`;
  r += `| Limite de bloco | ${perfil.targets.maxBlockLimit}% |\n`;
  r += `\n`;

  // Distribuição de níveis de performance
  const distNiveis = {
    EXCELENTE: evaluations.filter(e => e.nivel === "EXCELENTE").length,
    BOM:       evaluations.filter(e => e.nivel === "BOM").length,
    ATENCAO:   evaluations.filter(e => e.nivel === "ATENCAO").length,
    CRITICO:   evaluations.filter(e => e.nivel === "CRITICO").length,
  };
  r += `### Distribuição de Performance\n`;
  r += `| Nível | Conferentes | % do time |\n`;
  r += `|-------|-------------|-----------|\n`;
  r += `| ✅ EXCELENTE | ${distNiveis.EXCELENTE} | ${Math.round(distNiveis.EXCELENTE/resumo.totalConferentes*100)}% |\n`;
  r += `| 🔵 BOM | ${distNiveis.BOM} | ${Math.round(distNiveis.BOM/resumo.totalConferentes*100)}% |\n`;
  r += `| 🟠 ATENÇÃO | ${distNiveis.ATENCAO} | ${Math.round(distNiveis.ATENCAO/resumo.totalConferentes*100)}% |\n`;
  r += `| 🔴 CRÍTICO | ${distNiveis.CRITICO} | ${Math.round(distNiveis.CRITICO/resumo.totalConferentes*100)}% |\n`;
  r += `\n---\n\n`;


  r += `## 2. RANKING COMPLETO\n\n`;
  r += `| # | Nome | Nível Exp. | Score | Nível | Prod | % Erro | ICV | Tags |\n`;
  r += `|---|------|------------|-------|------|------|--------|-----|------|\n`;
  evaluations.forEach((e, i) => {
    const icvStr = e.icv !== undefined ? Math.round(e.icv) + '%' : '-';
    const expStr = e.input.experiencia ? e.input.experiencia.toUpperCase() : '-';
    r += `| ${i + 1} | ${e.input.nome} | ${expStr} | ${e.scoreFinal} | ${e.nivel} | ${
      e.input.produtividade
    } | ${e.pctErro.toFixed(2)} | ${icvStr} | ${
      e.tags.join(" · ") || "-"
    } |\n`;
  });
  r += `\n---\n\n`;

  r += `## 3. TOP 5 MELHORES\n\n`;
  top5.forEach((e, i) => {
    const icvStr = e.icv !== undefined ? Math.round(e.icv) + '%' : '-';
    const expStr = e.input.experiencia ? e.input.experiencia.toUpperCase() : '-';
    r += `**${i + 1}º - ${e.input.nome}** (Score: ${e.scoreFinal} - ${
      e.nivel
    })\n`;
    r += `- Experiência: ${expStr} | Produtividade: ${e.input.produtividade} itens/h | % Erro: ${e.pctErro.toFixed(
      2,
    )}% | ICV: ${icvStr}\n`;
    if (e.tags.length > 0) {
      r += `- Tags: ${e.tags.join(" · ")}\n`;
    }
    r += `\n`;
  });
  r += `---\n\n`;

  r += `## 4. CONFERENTES EM ALERTA / CRÍTICO\n\n`;
  if (bottom5.length === 0) {
    r += `Nenhum conferente em nível crítico.\n\n`;
  } else {
    bottom5.forEach((e, i) => {
      const pos = evaluations.length - 5 + i;
      r += `**${pos + 1}º - ${e.input.nome}** (Score: ${e.scoreFinal} - ${
        e.nivel
      })\n`;
      r += `- Produtividade: ${e.input.produtividade} itens/h | % Erro: ${e.pctErro.toFixed(
        2,
      )}% | % Bloco: ${e.pctBloco.toFixed(1)}%\n`;
      if (e.tags.length > 0) {
        r += `- Tags: ${e.tags.join(" · ")}\n`;
      }
      r += `\n`;
    });
  }
  r += `---\n\n`;

  r += `## 5. RADAR DE RISCO (Risco de Contagem Superficial / Nível crítico)\n\n`;
  if (risco.length === 0) {
    r += `Nenhum conferente classificado como risco elevado.\n\n`;
  } else {
    risco.forEach((e) => {
      r += `• ${e.input.nome} — Score ${e.scoreFinal} (${e.nivel}) | % Erro: ${e.pctErro.toFixed(
        2,
      )}% | % Bloco: ${e.pctBloco.toFixed(1)}% | Tags: ${
        e.tags.join(" · ") || "-"
      }\n`;
    });
    r += `\n`;
  }
  r += `---\n\n`;

  r += `## 6. PLANO DE AÇÃO SUGERIDO\n\n`;
  r += `- Reforçar reconhecimento dos Top 3 MVPs da operação.\n`;
  r += `- Para conferentes com score abaixo de 70: realizar feedback individual e plano de melhoria.\n`;
  r += `- Para casos com tag "🚨 Risco de Contagem Superficial": revisar amostras de contagem, reforçar limite de bloco e checar se houve pressão de tempo.\n`;
  r += `- Revisar meta de produtividade e aderência à política de contagem 1a1 conforme perfil da operação.\n\n`;

  r += `---\n\n`;
  r += `*Relatório gerado pela Avaliação - Módulo Avaliação (score Qualidade/Produtividade/Aderência)*\n`;
  r += `Data: ${new Date().toLocaleDateString("pt-BR")}\n`;

  // MAPA DE ACURÁCIA DE SEÇÕES (opcional — só quando dados estendidos estão disponíveis)
  if (sectionAccuracy && sectionAccuracy.length > 0) {
    r += `\n---\n\n`;
    r += `## 7. MAPA DE ACURÁCIA DE SEÇÕES FÍSICAS\n\n`;
    r += `> **Como interpretar:** Acurácia = 1 - (Σ|Ajuste| / Σ Contado). \n`;
    r += `> 🚨 Crítico (<97.5%) | ⚠️ Atenção (97.5-99%) | ✅ OK (≥99%) | ⭐ Perfeito (100%)\n\n`;
    r += `| Seção | Contado | Ajuste Absoluto | Saldo Líquido | Acurácia | Status |\n`;
    r += `|-------|---------|-----------------|---------------|----------|--------|\n`;
    for (const s of sectionAccuracy) {
      const acc = s.acuracidade.toFixed(2);
      const status =
        s.acuracidade === 100 ? "⭐ Perfeito" :
        s.acuracidade >= 99   ? "✅ OK" :
        s.acuracidade >= 97.5 ? "⚠️ Atenção" :
                                "🚨 Crítico";
      const saldo = s.ajusteLiquido >= 0 ? `+${s.ajusteLiquido.toFixed(0)}` : s.ajusteLiquido.toFixed(0);
      r += `| ${s.area} | ${s.totalC1.toFixed(0)} | ${s.ajusteAbsoluto.toFixed(0)} | ${saldo} | ${acc}% | ${status} |\n`;
    }
    r += `\n`;
    const criticas = sectionAccuracy.filter(s => s.acuracidade < 97.5);
    if (criticas.length > 0) {
      r += `### 🚨 Seções Críticas — Ação Imediata Recomendada\n\n`;
      criticas.forEach(s => {
        r += `**${s.area}** — Acurácia: ${s.acuracidade.toFixed(2)}% | Colaboradores: ${s.colaboradores.join(", ")}\n`;
        if (s.ajusteLiquido === 0 && s.ajusteAbsoluto > 20) {
          r += `  ⚠️ Saldo zero com ajuste alto = produtos trocados/mal etiquetados na gôndola.\n`;
        } else if (s.ajusteLiquido < 0) {
          r += `  📦 Saldo negativo = provável sobre-contagem ou reposição após contagem.\n`;
        } else {
          r += `  📋 Saldo positivo = provável sub-contagem ou produto sem bip.\n`;
        }
        r += `\n`;
      });
    }
  }

  return r;
}

export function generateInventExpIndividualReportText(
  operationType: InventoryOperationType,
  ev: InventoryCheckerEvaluation,
  rank: number,
  totalConferentes: number,
  dataInventario?: string,
): string {
  const data = dataInventario ?? new Date().toLocaleDateString("pt-BR");
  const perfil = INVENTORY_PROFILES[operationType];
  const d = ev.input;

  let r = "";
  r += `# RELATÓRIO INDIVIDUAL - Avaliação\n`;
  r += `## Inventário: ${data}\n`;
  r += `## Operação: ${operationType}\n\n`;
  r += `---\n\n`;

  r += `## 👤 CONFERENTE: ${d.nome}\n\n`;
  r += `Score Final: ${ev.scoreFinal} / 100 — ${ev.nivel}\n`;
  r += `Posição no ranking: ${rank}º de ${totalConferentes}\n\n`;
  r += `---\n\n`;

  r += `## 📊 OS SEUS NÚMEROS GERAIS\n\n`;
  r += `- Experiência reconhecida: **${(d.experiencia || 'Pleno').toUpperCase()}**\n`;
  r += `- Total de peças contadas: ${d.qtde}\n`;
  if (ev.minimoEsperado && ev.minimoEsperado > 0) {
    r += `- Meta de volume estimada para seu nível: ${ev.minimoEsperado} peças\n`;
    r += `- **ICV (Índice de Cumprimento de Volume): ${Math.round(ev.icv || 0)}%**\n`;
  }
  r += `- Ritmo médio: ${d.produtividade} itens/h (meta do perfil: ${perfil.targets.productivity} itens/h)\n`;
  r += `- % Erro: ${ev.pctErro.toFixed(2)}%\n`;
  r += `- % Bloco: ${ev.pctBloco.toFixed(1)}% (limite recomendado: ${perfil.targets.maxBlockLimit}%)\n\n`;
  r += `---\n\n`;

  r += `## 🔍 RAIO-X DA SUA QUALIDADE OPERACIONAL\n`;
  r += `Para te ajudar a entender seus pontos fortes e onde precisamos redobrar a atenção, mapeamos o comportamento das suas seções:\n\n`;
  
  r += `- **Erros de Execução (Quantidade direta)**: ${d.erro} erros.\n`;
  r += `  _(Produto bipado, mas a quantidade digitada na tela foi maior/menor que o real)_\n\n`;
  
  r += `- **Itens Esquecidos na Gôndola (Omissão)**: ${d.itensPulados || 0} produtos.\n`;
  r += `  _(Prateleira pulada ou produto sem bip. Afeta diretamente a quebra física da loja!)_\n\n`;

  r += `- **Contagens Duplicadas (Excesso)**: ${d.itensDuplicados || 0} produtos.\n`;
  r += `  _(Produto bipado por engano ou gancho repetido que já havia sido contado)_\n\n`;

  if (d.erroSecao !== undefined) {
    r += `- **Erro de Seção (Σ|Ajuste Área|)**: ${d.erroSecao} unidades.\n`;
    r += `  _(Soma dos ajustes modulares após recontagem das seções físicas)_\n\n`;
    if (ev.icsi !== undefined) {
      const icsiPct = Math.round(ev.icsi * 100);
      r += `- **ICSI (Índice de Consistência Seção/Item)**: ${icsiPct}%\n`;
      if (icsiPct >= 80) {
        r += `  _(Alto: seus erros são diretos e identificáveis — mais fácil de corrigir com treinamento)_\n\n`;
      } else if (icsiPct >= 50) {
        r += `  _(Médio: parte dos erros se compensou internamente nas seções)_\n\n`;
      } else {
        r += `  _(Baixo: erros em direções opostas dentro das seções — risco oculto na gôndola)_\n\n`;
      }
    }
  }
  r += `---\n\n`;


  r += `## 🎯 COMO A SUA NOTA FOI CALCULADA\n\n`;
  r += `- Qualidade: ${Math.round(ev.scoreQualidade)} pts\n`;
  r += `- Produtividade: ${Math.round(ev.scoreProdutividade)} pts\n`;
  r += `- Aderência ao método: ${Math.round(ev.scoreAderencia)} pts\n`;
  if (ev.pontosVolume !== undefined) {
    r += `- Volume (ICV): ${Math.round(ev.pontosVolume)} pts\n`;
  }
  if (ev.bonusVolume) r += `  + Bônus Volume: ${ev.bonusVolume} pts\n`;
  if (ev.penalidadeVolume) r += `  - Penalidade Volume: ${ev.penalidadeVolume} pts\n`;
  r += `\n`;

  if (ev.pctErro > perfil.targets.erroCritico) {
    r += `• A sua taxa de erro ficou acima do limite crítico do perfil, reduzindo parte da nota de produtividade.\n`;
  }
  if (ev.pctBloco > perfil.targets.maxBlockLimit) {
    r += `• O uso de contagem em Bloco acima do limite recomendado reduziu a nota de aderência ao método.\n`;
  }
  if (
    d.produtividade > perfil.targets.productivity &&
    ev.pctErro <= perfil.targets.erroTolerancia
  ) {
    r += `• Você recebeu bônus por manter boa qualidade mesmo com produtividade acima da meta.\n`;
  }
  if (ev.tags.includes("🚨 Risco de Contagem Superficial")) {
    r += `• Foi identificado risco de contagem superficial (erro alto combinado com muito bloco). Revise os critérios de quando usar bloco.\n`;
  }
  if (
    ev.pctErro <= perfil.targets.erroTolerancia &&
    ev.pctBloco <= perfil.targets.maxBlockLimit
  ) {
    r += `• A sua atuação está dentro dos parâmetros esperados de qualidade e aderência ao método para este perfil.\n`;
  }
  r += `\n---\n\n`;

  if (ev.tags.length > 0) {
    r += `## 🏅 TAGS E DESTAQUES\n\n`;
    ev.tags.forEach((tag) => {
      r += `• ${tag}\n`;
    });
    r += `\n---\n\n`;
  }

  r += `## 📌 DIRECIONAMENTO PARA O PRÓXIMO INVENTÁRIO\n\n`;
  
  const pulados = d.itensPulados || 0;
  const duplicados = d.itensDuplicados || 0;

  if (pulados > 15) {
    r += `💡 **Foco em Varredura:** No próximo inventário, sua atenção deve ser voltada para a varredura visual completa da prateleira (da esquerda para a direita, de cima para baixo), garantindo que nenhum produto ou gancho fique para trás sem o bip.\n\n`;
  } else if (duplicados > 20) {
    r += `💡 **Foco em Demarcação:** Certifique-se de marcar visualmente ou usar as etiquetas de marcação nas seções para nunca recontar uma área que você ou seu colega já finalizaram.\n\n`;
  } else if (ev.nivel === "EXCELENTE" || ev.nivel === "BOM") {
    r += `✅ **Manter o Padrão:** Continue mantendo o equilíbrio atual entre velocidade e qualidade. Seus números de atenção visual estão muito bons!\n\n`;
  } else {
    r += `⚠️ **Ajuste de Qualidade:** Priorize reduzir o % de erro bruto digitado. Revise junto à liderança os principais tipos de erros ocorridos hoje e reduza o uso de contagem em bloco quando não for estritamente necessário.\n\n`;
  }

  r += `Contamos com sua atenção e evolução no próximo processo!\n`;
  r += `\n---\n\n`;

  r += `*Relatório gerado pela Avaliação - Módulo Avaliação (Qualidade · Produtividade · Aderência)*\n`;
  r += `Data: ${new Date().toLocaleDateString("pt-BR")}\n`;

  return r;
}

``n

## Arquivo: src\screens\InventExpImportScreen.tsx
`	ypescript
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import React, { useMemo, useState } from "react";
import {
    Alert,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CheckerFeedbackReport } from "../components/CheckerFeedbackReport";
import { INVENTORY_PROFILES } from "../config/inventoryEvalConfig";
import {
    evaluateChecker,
    sortRanking,
    getDistribuicaoNiveis,
} from "../services/InventoryEvaluationService";
import { getCheckerCurrentLevel } from "../services/CheckerDBService";
import type {
    InventoryCheckerEvaluation,
    InventoryOperationType,
    SectionAccuracyRecord,
} from "../types";
import { shareCsvFile, shareTextFile } from "../utils/export";
import { readFileAsCsvText } from "../utils/fileImport";
import {
    generateInventExpGerencialReportText,
    generateInventExpIndividualReportText,
} from "../utils/inventExpReports";
import { parseInventoryCheckersCsv, parseTagsExtended } from "../utils/parsers";


const EXAMPLE_INVENTEXP_CSV = `NOME DO CONFERENTE;PRODUTIVIDADE;QTDE. VOLUMES;1a1;BLOCO;HORAS ESTIMADAS;ERRO;% ERRO
AMANDA DE OLIVEIRA P...;395,33;752;0;18;1,9;13;1,73%`;

const EXAMPLE_TAGS_CSV = `Nome;Qtd(A1)
AMANDA DE OLIVEIRA P...;15
CAMILA FERREIRA;-5`;

export default function InventExpImportScreen() {
  const [operationType, setOperationType] =
    useState<InventoryOperationType>("FARMACIA");
  const [rawText, setRawText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [totalPecas, setTotalPecas] = useState("");
  const [duracaoReal, setDuracaoReal] = useState("");
  const [evaluations, setEvaluations] = useState<InventoryCheckerEvaluation[]>([]);
  const [sectionAccuracy, setSectionAccuracy] = useState<SectionAccuracyRecord[]>([]);
  const [isExtendedTags, setIsExtendedTags] = useState(false);


  const handlePickFile = async (type: 'prod' | 'tags') => {
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
      if (type === 'prod') setRawText(text);
      else setTagsText(text);
      Alert.alert(
        "Arquivo carregado",
        `${file.name} importado para ${type === 'prod' ? 'Produtividade' : 'Tags'}.`,
      );
    } catch (e) {
      Alert.alert("Erro", "Não foi possível ler o arquivo.");
    }
  };

  const handleProcess = async () => {
    const parsed = parseInventoryCheckersCsv(rawText);
    const tagsResult = parseTagsExtended(tagsText);

    if (parsed.length === 0) {
      Alert.alert(
        "Dados inválidos",
        "Cole a tabela ou anexe CSV/Excel de Produtividade.",
      );
      return;
    }
    const pecas = parseInt(totalPecas.replace(/\D/g, "")) || 0;
    const duracao = parseFloat(duracaoReal.replace(",", ".")) || 5;
    const totalConferentes = parsed.length;

    const parsedWithExp = await Promise.all(
      parsed.map(async (item) => {
        const exp = await getCheckerCurrentLevel(item.nome);
        const nomeKey = item.nome.toLowerCase().trim();
        const tagsData = tagsResult.porColaborador[nomeKey] || {
          itensPulados: 0, itensDuplicados: 0, erroSecao: undefined, numSecoes: undefined,
        };
        return {
          ...item,
          experiencia: exp,
          itensPulados: tagsData.itensPulados,
          itensDuplicados: tagsData.itensDuplicados,
          erroSecao: tagsResult.isExtended ? tagsData.erroSecao : undefined,
          numSecoes: tagsResult.isExtended ? tagsData.numSecoes : undefined,
        };
      })
    );

    const evaluated = parsedWithExp.map((item) =>
      evaluateChecker(item, operationType, pecas, duracao, totalConferentes),
    );
    setEvaluations(sortRanking(evaluated));

    // Salva dados de acurácia de seções quando formato estendido
    if (tagsResult.isExtended && tagsResult.porArea.length > 0) {
      setSectionAccuracy(tagsResult.porArea);
      setIsExtendedTags(true);
    } else {
      setSectionAccuracy([]);
      setIsExtendedTags(false);
    }
  };


  const resumo = useMemo(() => {
    if (evaluations.length === 0) return null;
    const totalConferentes = evaluations.length;
    const totalItens = evaluations.reduce((s, e) => s + e.input.qtde, 0);
    const totalErros = evaluations.reduce((s, e) => s + e.input.erro, 0);
    const taxaMediaErro = totalItens > 0 ? (totalErros / totalItens) * 100 : 0;
    const produtividadeMedia =
      evaluations.reduce((s, e) => s + e.input.produtividade, 0) /
      evaluations.length;
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


  const handleExportCsv = async () => {
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
  };

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

  const profile = INVENTORY_PROFILES[operationType];

  const handleExportGerencial = async () => {
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
      `relatorio_gerencial_avaliacao_${new Date()
        .toISOString()
        .slice(0, 10)}.txt`,
      text,
      "Exportar Relatório Gerencial Avaliação",
    );
  };


  const handleSendIndividualWhatsApp = (
    ev: InventoryCheckerEvaluation,
    index: number,
  ) => {
    const text = generateInventExpIndividualReportText(
      operationType,
      ev,
      index + 1,
      evaluations.length,
    );
    const waUrl = Platform.OS === "web"
      ? `https://wa.me/?text=${encodeURIComponent(text)}`
      : `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(waUrl).catch(
      () =>
        Alert.alert(
          "Erro",
          "N\u00e3o foi poss\u00edvel abrir o WhatsApp neste dispositivo.",
        ),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.segmentContainer}>
          {(
            [
              "FARMACIA",
              "SUPERMERCADO",
              "LOJA_GERAL",
            ] as InventoryOperationType[]
          ).map((type) => {
            const active = operationType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setOperationType(type)}
                style={[
                  styles.segmentButton,
                  active && styles.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    active && styles.segmentLabelActive,
                  ]}
                >
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Importar dados dos conferentes</Text>
          <Text style={styles.subtitle}>
            Cole a tabela (vírgula, ponto e vírgula ou tab) ou anexe arquivo
            CSV/Excel. Colunas: Nome, Qtde, Qtde1a1, Produtividade (itens/h),
            Erro (qtde).
          </Text>
          <View style={styles.importRow}>
            <View style={{flex: 1}}>
              <Text style={styles.label}>Total de Peças</Text>
              <TextInput value={totalPecas} onChangeText={setTotalPecas} placeholder="Ex: 15000" keyboardType="numeric" style={styles.input} />
            </View>
            <View style={{flex: 1, marginLeft: 12}}>
              <Text style={styles.label}>Duração (horas)</Text>
              <TextInput value={duracaoReal} onChangeText={setDuracaoReal} placeholder="Ex: 5.5" keyboardType="numeric" style={styles.input} />
            </View>
          </View>
          <View style={styles.importRow}>
            <Pressable onPress={() => handlePickFile('prod')} style={styles.btnAttach}>
              <Ionicons name="attach" size={20} color="#2563EB" />
              <Text style={styles.btnAttachText}>Anexar Produtividade</Text>
            </Pressable>
            <Pressable onPress={() => handlePickFile('tags')} style={[styles.btnAttach, { marginLeft: 10 }]}>
              <Ionicons name="attach" size={20} color="#059669" />
              <Text style={[styles.btnAttachText, { color: "#059669" }]}>Anexar Tags (Omissão/Excesso)</Text>
            </Pressable>
          </View>
          <Text style={styles.label}>1. Produtividade (Geral)</Text>
          <TextInput
            value={rawText}
            onChangeText={setRawText}
            placeholder={EXAMPLE_INVENTEXP_CSV}
            placeholderTextColor="#94A3B8"
            multiline
            style={styles.textArea}
            textAlignVertical="top"
          />
          <Text style={[styles.label, { marginTop: 12 }]}>2. Produtividade Tags (Qtd A1)</Text>
          <TextInput
            value={tagsText}
            onChangeText={setTagsText}
            placeholder={EXAMPLE_TAGS_CSV}
            placeholderTextColor="#94A3B8"
            multiline
            style={[styles.textArea, { minHeight: 80 }]}
            textAlignVertical="top"
          />
          <Pressable onPress={() => void handleProcess()} style={styles.btnPrimary}>
            <Ionicons name="calculator-outline" size={20} color="#fff" />
            <Text style={styles.btnTextWhite}>Processar Avaliação</Text>
          </Pressable>
        </View>

        {resumo && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Resumo da Avaliação</Text>
              <View style={styles.resumoGrid}>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>{resumo.totalConferentes}</Text>
                  <Text style={styles.resumoLabel}>Conferentes</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>
                    {resumo.totalItens.toLocaleString("pt-BR")}
                  </Text>
                  <Text style={styles.resumoLabel}>Itens contados</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>{resumo.taxaMediaErro}%</Text>
                  <Text style={styles.resumoLabel}>Taxa média erro</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>{resumo.produtividadeMedia}</Text>
                  <Text style={styles.resumoLabel}>Prod/h média</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>{resumo.scoreMedio}</Text>
                  <Text style={styles.resumoLabel}>Score médio</Text>
                </View>
              </View>
              {/* Pills de distribuição de performance */}
              {resumo.dist && (
                <View style={styles.distRow}>
                  {resumo.dist.EXCELENTE > 0 && (
                    <View style={[styles.distPill, { backgroundColor: "#16a34a" }]}>
                      <Text style={styles.distPillText}>
                        {resumo.dist.EXCELENTE} EXCELENTE
                      </Text>
                    </View>
                  )}
                  {resumo.dist.BOM > 0 && (
                    <View style={[styles.distPill, { backgroundColor: "#2563eb" }]}>
                      <Text style={styles.distPillText}>{resumo.dist.BOM} BOM</Text>
                    </View>
                  )}
                  {resumo.dist.ATENCAO > 0 && (
                    <View style={[styles.distPill, { backgroundColor: "#f97316" }]}>
                      <Text style={styles.distPillText}>
                        {resumo.dist.ATENCAO} ATENÇÃO
                      </Text>
                    </View>
                  )}
                  {resumo.dist.CRITICO > 0 && (
                    <View style={[styles.distPill, { backgroundColor: "#dc2626" }]}>
                      <Text style={styles.distPillText}>
                        {resumo.dist.CRITICO} CRÍTICO
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>


            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top 3 MVPs</Text>
              <View style={styles.mvpRow}>
                {top3.map((ev, index) => (
                  <View key={ev.input.nome} style={styles.mvpCard}>
                    <Text style={styles.mvpRank}>{index + 1}º</Text>
                    <Text style={styles.mvpName}>{ev.input.nome}</Text>
                    <Text style={[styles.mvpScore, { color: ev.nivelColor }]}>
                      {ev.scoreFinal}
                    </Text>
                    <Text style={styles.mvpLevel}>{ev.nivel}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ranking Avaliação</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 0.5 }]}>#</Text>
                <Text style={[styles.th, { flex: 1.5 }]}>Conferente</Text>
                <Text style={[styles.th, { flex: 0.7 }]}>Score</Text>
                <Text style={[styles.th, { flex: 0.8 }]}>% Erro</Text>
                <Text style={[styles.th, { flex: 0.9 }]}>Prod/h</Text>
                {isExtendedTags && (
                  <Text style={[styles.th, { flex: 0.8 }]}>Err.Seç</Text>
                )}
              </View>
              {evaluations.map((ev, index) => (
                <Pressable
                  key={ev.input.nome}
                  style={styles.tableRow}
                  onPress={() => handleSendIndividualWhatsApp(ev, index)}
                >
                  <Text style={[styles.tdRank, { flex: 0.5 }]}>{index + 1}º</Text>
                  <Text style={[styles.tdNome, { flex: 1.5 }]}>{ev.input.nome}</Text>
                  <Text style={[styles.tdScore, { flex: 0.7, color: ev.nivelColor }]}>
                    {ev.scoreFinal}
                  </Text>
                  <Text style={[styles.td, { flex: 0.8 }]}>
                    {ev.pctErro.toFixed(2)}%
                  </Text>
                  <Text style={[styles.td, { flex: 0.9 }]}>
                    {ev.input.produtividade}
                  </Text>
                  {isExtendedTags && (
                    <Text style={[
                      styles.td,
                      { flex: 0.8, color: ev.icsi !== undefined && ev.icsi < 0.5 ? "#f97316" : "#475569" }
                    ]}>
                      {ev.input.erroSecao ?? "-"}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>


            {radarRisco.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Radar de Risco</Text>
                <Text style={styles.cardSubtitle}>
                  Conferentes com risco de contagem superficial ou classificação
                  crítica.
                </Text>
                {radarRisco.map((ev) => (
                  <View key={ev.input.nome} style={styles.riskRow}>
                    <View style={styles.riskHeader}>
                      <View
                        style={[
                          styles.riskDot,
                          { backgroundColor: ev.nivelColor },
                        ]}
                      />
                      <Text style={styles.riskName}>{ev.input.nome}</Text>
                      <Text style={styles.riskScore}>{ev.scoreFinal}</Text>
                    </View>
                    <Text style={styles.riskMeta}>
                      % Erro: {ev.pctErro.toFixed(2)}% | Bloco:{" "}
                      {ev.pctBloco.toFixed(1)}% | Prod/h:{" "}
                      {ev.input.produtividade}
                    </Text>
                    {ev.tags.length > 0 && (
                      <Text style={styles.riskTags}>{ev.tags.join(" · ")}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {evaluations[0] && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Exemplo de recibo do conferente</Text>
                <CheckerFeedbackReport
                  evaluation={evaluations[0]}
                  operationType={operationType}
                />
              </View>
            )}

            {/* Card Mapa de Acurácia de Seções */}
            {isExtendedTags && sectionAccuracy.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🇳🇪 Mapa de Acurácia de Seções</Text>
                <Text style={styles.cardSubtitle}>
                  Acurácia = 1 − (|Σ Ajuste| ÷ Total Contado). Ordenado do mais crítico ao perfeito.
                </Text>
                {sectionAccuracy.map((s) => {
                  const isRisk = s.acuracidade < 97.5;
                  const isOk   = s.acuracidade >= 99;
                  const dotColor = s.acuracidade === 100 ? "#16a34a" :
                                   isOk ? "#2563eb" :
                                   isRisk ? "#dc2626" : "#f97316";
                  return (
                    <View key={s.area} style={[
                      styles.sectionRow,
                      isRisk && { backgroundColor: "#fef2f2" },
                    ]}>
                      <View style={styles.sectionHeader}>
                        <View style={[styles.sectionDot, { backgroundColor: dotColor }]} />
                        <Text style={styles.sectionName}>{s.area}</Text>
                        <Text style={[styles.sectionAcc, { color: dotColor }]}>
                          {s.acuracidade.toFixed(2)}%
                        </Text>
                      </View>
                      <View style={styles.sectionMeta}>
                        <Text style={styles.sectionMetaText}>
                          Contado: {s.totalC1.toFixed(0)}
                        </Text>
                        <Text style={styles.sectionMetaText}>
                          Ajuste: {s.ajusteAbsoluto.toFixed(0)}
                        </Text>
                        <Text style={[styles.sectionMetaText, {
                          color: s.ajusteLiquido < 0 ? "#dc2626" : s.ajusteLiquido > 0 ? "#f97316" : "#64748b"
                        }]}>
                          Saldo: {s.ajusteLiquido >= 0 ? "+" : ""}{s.ajusteLiquido.toFixed(0)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.exportRow}>
              <Pressable
                onPress={() => void handleExportCsv()}
                style={styles.btnExport}
              >
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.btnTextWhite}>Exportar CSV Avaliação</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleExportGerencial()}
                style={[styles.btnExport, { backgroundColor: "#4f46e5" }]}
              >
                <Ionicons name="document-text-outline" size={20} color="#fff" />
                <Text style={styles.btnTextWhite}>Relatório Gerencial</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#1d4ed8",
  },
  headerLogo: {
    width: 36,
    height: 36,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#1d4ed8",
  },
  segmentLabel: {
    fontSize: 12,
    color: "#1e293b",
    fontWeight: "500",
  },
  segmentLabelActive: {
    color: "#ffffff",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
  },
  importRow: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 8,
  },
  btnAttach: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#EFF6FF",
  },
  btnAttachText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#2563EB",
  },
  textArea: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    minHeight: 120,
    fontSize: 13,
    fontFamily: "System",
    color: "#0f172a",
    backgroundColor: "#F8FAFC",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  btnPrimary: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnTextWhite: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  resumoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  resumoItem: {
    width: "30%",
    minWidth: 96,
  },
  resumoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  resumoLabel: {
    fontSize: 11,
    color: "#64748b",
  },
  mvpRow: {
    flexDirection: "row",
    gap: 10,
  },
  mvpCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    gap: 4,
  },
  mvpRank: {
    fontSize: 12,
    color: "#64748b",
  },
  mvpName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
  },
  mvpScore: {
    fontSize: 18,
    fontWeight: "700",
  },
  mvpLevel: {
    fontSize: 11,
    color: "#475569",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 4,
    marginBottom: 4,
  },
  th: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  td: {
    fontSize: 11,
    color: "#475569",
  },
  tdRank: {
    fontSize: 11,
    color: "#64748b",
  },
  tdNome: {
    fontSize: 12,
    color: "#0f172a",
  },
  tdScore: {
    fontSize: 12,
    fontWeight: "600",
  },
  riskRow: {
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    padding: 10,
    marginTop: 8,
    gap: 4,
  },
  riskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  riskName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#7f1d1d",
  },
  riskScore: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7f1d1d",
  },
  riskMeta: {
    fontSize: 11,
    color: "#7f1d1d",
  },
  riskTags: {
    fontSize: 11,
    color: "#7f1d1d",
    fontStyle: "italic",
  },
  exportRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  btnExport: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#059669",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  // Pills de distribuição de performance
  distRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  distPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  distPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  // Mapa de Seções
  sectionRow: {
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
    marginTop: 6,
    gap: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  sectionAcc: {
    fontSize: 13,
    fontWeight: "700",
  },
  sectionMeta: {
    flexDirection: "row",
    gap: 12,
    marginLeft: 16,
  },
  sectionMetaText: {
    fontSize: 11,
    color: "#64748b",
  },
});

``n

## Arquivo: src\components\CheckerFeedbackReport.tsx
`	ypescript
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { INVENTORY_PROFILES } from "../config/inventoryEvalConfig";
import type {
  InventoryCheckerEvaluation,
  InventoryOperationType,
} from "../types";

interface CheckerFeedbackReportProps {
  evaluation: InventoryCheckerEvaluation;
  operationType: InventoryOperationType;
}

export function CheckerFeedbackReport({
  evaluation,
  operationType,
}: CheckerFeedbackReportProps) {
  const profile = INVENTORY_PROFILES[operationType];
  const { targets, alerts } = profile;

  const { input, pctErro, pctBloco, nivelColor, nivel, tags, scoreFinal } =
    evaluation;

  const pct1a1 = 100 - pctBloco;

  const mensagens: string[] = [];

  if (pctErro > targets.erroCritico) {
    mensagens.push(
      "Parte da sua produtividade foi reduzida porque a taxa de erro ficou acima do limite crítico.",
    );
  }
  if (pctBloco > targets.maxBlockLimit) {
    mensagens.push(
      "Você perdeu pontos de aderência pelo uso acima do recomendado de contagem em bloco.",
    );
  }
  if (pctErro <= targets.erroTolerancia && input.produtividade > targets.productivity) {
    mensagens.push(
      "Você recebeu bônus por manter boa qualidade mesmo com produtividade acima da meta.",
    );
  }
  if (pctErro > 1.5 && pctBloco > alerts.criticalBlockLimit) {
    mensagens.push(
      "Foi identificado risco de contagem superficial (erro alto com muito bloco).",
    );
  }
  if (evaluation.minimoEsperado && evaluation.minimoEsperado > 0) {
    if (evaluation.bonusVolume) {
      mensagens.push(`Excelente volume! Você superou sua meta de peças contadas e ganhou ${evaluation.bonusVolume} pontos de bônus.`);
    } else if (evaluation.penalidadeVolume) {
      mensagens.push(`Seu volume de contagem ficou abaixo do esperado para o seu nível de experiência, resultando em uma penalidade de ${evaluation.penalidadeVolume} pontos.`);
    }
  }
  if (mensagens.length === 0) {
    mensagens.push(
      "A sua nota foi calculada equilibrando qualidade, produtividade e aderência ao método.",
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { borderColor: nivelColor }]}>
        <View style={styles.headerInfo}>
          <Text style={styles.nome}>{input.nome}</Text>
          <Text style={[styles.nivel, { color: nivelColor }]}>{nivel}</Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: nivelColor }]}>
          <Text style={styles.scoreText}>{scoreFinal}</Text>
        </View>
      </View>

      {tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Os seus números</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Total de peças</Text>
            <Text style={styles.metricValue}>{input.qtde}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Ritmo (itens/h)</Text>
            <Text style={styles.metricValue}>{input.produtividade}</Text>
          </View>
        </View>
        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>% Erro</Text>
            <Text style={styles.metricValue}>{pctErro.toFixed(2)}%</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>ICV (Volume)</Text>
            <Text style={styles.metricValue}>
              {evaluation.icv !== undefined ? Math.round(evaluation.icv) + "%" : "-"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Como a sua nota foi calculada</Text>
        {mensagens.map((m) => (
          <Text key={m} style={styles.explanationText}>
            • {m}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  nome: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
  },
  nivel: {
    fontSize: 14,
    fontWeight: "500",
  },
  scoreBadge: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scoreText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#e0f2fe",
  },
  tagText: {
    fontSize: 12,
    color: "#0f172a",
  },
  section: {
    marginTop: 4,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
  },
  metricLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  explanationText: {
    fontSize: 13,
    color: "#334155",
  },
});


``n

