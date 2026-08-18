/**
 * Configuração do módulo de Avaliação de Conferentes (v2.1).
 *
 * LIMITES_BLOCO_FARMACIA espelha o seed canônico de:
 *   supabase/migration_limites_bloco_area.sql
 *   + supabase/migration_limites_bloco_area_patch1.sql (alias OTC)
 *
 * Fallback offline quando Supabase está vazio/indisponível.
 * Ausência de área na tabela = sem penalidade (console.warn).
 * limite 9999 = sem limite definido (não penalizar).
 */

import { chaveArea } from '../utils/inventExpUtils';

import {
  buildViolacaoBloco,
  type InventoryOperationType,
  type ViolacaoBloco,
} from "../types";

// ---------------------------------------------------------------------------
// Metas e penalidades
// ---------------------------------------------------------------------------

export const METAS_PRODUTIVIDADE: Record<string, number> = {
  EXPERT: 800,
  PLENO: 800,
  JUNIOR: 500,
  TRAINEE: 350,
};

/** Penalidade em pontos no componente Qualidade */
export const PENALIDADE_BLOCO_AREA_CRITICA = 20; // limite 0% / área crítica
export const PENALIDADE_BLOCO_EXCESSO_ALTO = 10; // excesso > 2× o limite
export const PENALIDADE_BLOCO_EXCESSO_LEVE = 5; // excesso até 2× o limite

/**
 * Pesos e penalidades do modelo v3 (avaliação com áreas e não contados).
 *
 * Calibrado no inventário DPSP L2601 (06/08/2026, 15 conferentes, 53.628 peças,
 * 38.588 bipadas, 56 divergências, 28 produtos não contados).
 *
 * Diferença para o modelo v2.1: a Qualidade deixa de ser o único eixo de erro.
 * O valor financeiro do ajuste ganha peso próprio, e a Cobertura passa a medir
 * o que ficou de fora da contagem — antes invisível na nota.
 */
export const AVALIACAO_V3 = {
  pesos: {
    /** Acuracidade em unidades: 1 − unidades em erro ÷ peças contadas. */
    acuracidade: 0.35,
    /** peças/h ÷ referência da equipe, limitado a 100. */
    produtividade: 0.25,
    /** 100 − (Vlr AJST ÷ Vlr C1 × 100). */
    valor: 0.25,
    /** 100 − fatia do valor perdida em não contados de confiança ALTA. */
    cobertura: 0.15,
  },
  /**
   * Referência de produtividade. A mediana da equipe é menos sensível aos
   * extremos que a média e que a meta fixa do perfil, que varia com o layout
   * da loja e com o tipo de mercadoria.
   */
  referenciaProdutividade: 'MEDIANA_EQUIPE' as 'MEDIANA_EQUIPE' | 'META_PERFIL',
  /** Pontos descontados por divergência em produto controlado. */
  penalidadeControlado: 5,
  /** Pontos descontados por não contado atribuído com confiança ALTA. */
  penalidadeNaoContadoAlta: 2,
  /** Seções que não são área física — auditoria dirigida no padrão DPSP. */
  secoesAuditoria: ['9999'],
  /** Intervalo sem bipada, em minutos, a partir do qual conta como ociosidade. */
  limiteOciosidadeMin: 15,
} as const;

export const FAIXAS_CLASSIFICACAO = {
  EXCELENTE: 90,
  BOM: 80,
  REGULAR: 70,
  // abaixo de 70 = CRÍTICO / ATENCAO
} as const;

/** Valor sentinela: área sem limite de bloco (não penalizar). */
export const LIMITE_BLOCO_SEM_LIMITE = 9999;

// ---------------------------------------------------------------------------
// Perfis de operação
// ---------------------------------------------------------------------------

export const INVENTORY_PROFILES = {
  FARMACIA: {
    weights: { quality: 0.55, productivity: 0.25, adherence: 0.2 },
    targets: {
      productivity: 800,
      maxBlockLimit: 20,
      erroTolerancia: 0.35,
      erroCritico: 0.8,
    },
    /** Decaimento exponencial da qualidade: 100 * e^(-k * pctErro) */
    qualityDecayK: 1.5,
    alerts: { criticalBlockLimit: 50 },
  },
  SUPERMERCADO: {
    weights: { quality: 0.45, productivity: 0.4, adherence: 0.15 },
    targets: {
      productivity: 1200,
      maxBlockLimit: 50,
      erroTolerancia: 1.0,
      erroCritico: 2.0,
    },
    qualityDecayK: 0.8,
    alerts: { criticalBlockLimit: 80 },
  },
  HIPERMERCADO: {
    weights: { quality: 0.45, productivity: 0.4, adherence: 0.15 },
    targets: {
      productivity: 1200,
      maxBlockLimit: 50,
      erroTolerancia: 1.0,
      erroCritico: 2.0,
    },
    qualityDecayK: 0.8,
    alerts: { criticalBlockLimit: 80 },
  },
  LOJA_GERAL: {
    weights: { quality: 0.5, productivity: 0.3, adherence: 0.2 },
    targets: {
      productivity: 1000,
      maxBlockLimit: 35,
      erroTolerancia: 0.8,
      erroCritico: 1.5,
    },
    qualityDecayK: 1.1,
    alerts: { criticalBlockLimit: 65 },
  },
  ATACADO: {
    weights: { quality: 0.45, productivity: 0.4, adherence: 0.15 },
    targets: {
      productivity: 1500,
      maxBlockLimit: 100,
      erroTolerancia: 1.5,
      erroCritico: 3.0,
    },
    qualityDecayK: 0.7,
    alerts: { criticalBlockLimit: 100 },
  },
} as const;

// ---------------------------------------------------------------------------
// Limites de bloco por área (FARMACIA) — seed canônico / fallback offline
// ---------------------------------------------------------------------------

export interface RegraBlocoArea {
  limite: number;
  critica: boolean;
}

/**
 * Chaves em UPPERCASE (normalizarNomeArea antes de consultar).
 * Valores alinhados à migration Supabase (fonte de verdade remota).
 */
export const LIMITES_BLOCO_FARMACIA: Record<string, RegraBlocoArea> = {
  // Proibido — tolerância zero (ANVISA/SNGPC)
  ANTIBIÓTICOS: { limite: 0, critica: true },
  "AVARIAS E VENCIDOS": { limite: 0, critica: true },
  MEDICAMENTOS: { limite: 0, critica: true },
  PSICOTRÓPICOS: { limite: 0, critica: true },
  TERMOLÁBEIS: { limite: 0, critica: true },
  CAIXAS: { limite: 0, critica: true },
  "GELADEIRAS MEDICAMENTOS": { limite: 0, critica: true },
  "SALA DE APLICAÇÃO": { limite: 0, critica: true },

  // Crítico — tolerância muito baixa (alerta formal: limite <= 5)
  "MEDICAMENTOS OTC": { limite: 5, critica: true },
  "P DERMO": { limite: 5, critica: true },
  /** Alias legado / XLS de campo (patch1) */
  "OTC / MIP (CAIXA)": { limite: 5, critica: true },

  // Com limite — não-críticas
  "P INFANTIL": { limite: 10, critica: false },
  "SUPLEMENTOS / VITAMINAS": { limite: 10, critica: false },
  "G 1": { limite: 15, critica: false },
  "G 2": { limite: 15, critica: false },
  "G 3": { limite: 15, critica: false },
  "G 4": { limite: 15, critica: false },
  "G 5": { limite: 15, critica: false },
  "G 6": { limite: 15, critica: false },
  "G 7": { limite: 15, critica: false },
  "G 8": { limite: 15, critica: false },
  "G 9": { limite: 15, critica: false },
  "G 10": { limite: 15, critica: false },
  "P PERFUMARIA / COSMÉTICOS": { limite: 15, critica: false },
  "MEDICAMENTOS CARTELADOS": { limite: 30, critica: false },
  ILHAS: { limite: 30, critica: false },
  ESTOQUE: { limite: 80, critica: false },
  "ESTOQUE 2": { limite: 80, critica: false },
  "ESTOQUE 3": { limite: 80, critica: false },
  "ESTOQUE FRENTE DE CAIXA": { limite: 90, critica: false },
  "FRENTE DE CAIXA": { limite: 90, critica: false },
  "ATRÁS DE CAIXA": { limite: 90, critica: false },
  "GELADEIRAS FRENTE CAIXA": { limite: 100, critica: false },
  SORVETES: { limite: 100, critica: false },
  CARTELADO: { limite: 100, critica: false },
  "NÃO CONTADOS": { limite: 100, critica: false },
  "BALCÃO DE ATENDIMENTO": { limite: LIMITE_BLOCO_SEM_LIMITE, critica: false },
};

export interface LimiteBlocoRow {
  tipo_operacao: string;
  nome_area: string;
  limite_pct: number;
  area_critica: boolean;
}

/** Converte o fallback local para o formato do repositório Supabase / detectarViolacoesBloco. */
export function getLimitesBlocoFallback(
  operationType: InventoryOperationType,
): LimiteBlocoRow[] {
  if (operationType !== "FARMACIA") return [];
  return Object.entries(LIMITES_BLOCO_FARMACIA).map(([nome_area, regra]) => ({
    tipo_operacao: "FARMACIA",
    nome_area,
    limite_pct: regra.limite,
    area_critica: regra.critica,
  }));
}

export function lookupLimiteBlocoArea(
  nomeArea: string,
  operationType: InventoryOperationType = "FARMACIA",
): RegraBlocoArea | null {
  if (operationType !== "FARMACIA") return null;
  const key = nomeArea.trim().toUpperCase();
  return LIMITES_BLOCO_FARMACIA[key] ?? null;
}

/**
 * Detecta violações de bloco a partir de seções (path legado / secoes sem .prc).
 *
 * Regras:
 * - Operação ≠ FARMACIA → []
 * - Área sem entrada → console.warn e **não penaliza** (nunca default 20%)
 * - limite >= 9999 → ignora
 *
 * `limites` opcional: quando fornecido (mesmo array do path .prc / Supabase),
 * usa essa fonte em vez do mapa local — evita divergência DB vs seed offline.
 */
export function getViolacoesBloco(
  secoes: { area: string; pctBloco: number }[],
  operationType: InventoryOperationType,
  limites?: LimiteBlocoRow[],
): ViolacaoBloco[] {
  if (operationType !== "FARMACIA") {
    return [];
  }

  const violacoes: ViolacaoBloco[] = [];
  const useRows = limites && limites.length > 0;

  for (const sec of secoes) {
    const areaNome = (sec.area || "").trim();
    if (!areaNome) continue;

    let limitePct: number;
    let areaCritica: boolean;

    if (useRows) {
      const row = limites!.find(
        (l) =>
          l.tipo_operacao === operationType &&
          chaveArea(l.nome_area) === chaveArea(areaNome),
      );
      if (!row) {
        console.warn(
          `[Avaliação] Área sem limite configurado: "${areaNome}" — ignorando (sem penalidade).`,
        );
        continue;
      }
      limitePct = row.limite_pct;
      areaCritica = row.area_critica;
    } else {
      const regra = lookupLimiteBlocoArea(areaNome, operationType);
      if (!regra) {
        console.warn(
          `[Avaliação] Área sem limite configurado: "${areaNome}" — ignorando (sem penalidade).`,
        );
        continue;
      }
      limitePct = regra.limite;
      areaCritica = regra.critica;
    }

    if (limitePct >= LIMITE_BLOCO_SEM_LIMITE) {
      continue;
    }

    if (sec.pctBloco > limitePct) {
      violacoes.push(
        buildViolacaoBloco({
          area_nome: areaNome,
          real_pct: sec.pctBloco,
          limite_pct: limitePct,
          area_critica: areaCritica,
        }),
      );
    }
  }

  return violacoes;
}
