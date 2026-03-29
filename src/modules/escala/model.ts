/**
 * InventExpert — Escala Module
 * model.ts — Entidades do domínio (tipagem forte, sem dependências externas)
 *
 * Regras de negócio encapsuladas:
 *  - ScoreCalculator: produtividade * 0.7 - erro * 0.3 + fator logístico
 *  - EscalaComposicao: 1 Líder + N Conferentes + 2 Reservas
 */

import type {
  Cliente,
  Colaborador,
  ColaboradorFuncao,
  EscalaItem,
  EscalaPapel,
  GerarEscalaResult,
  Inventario,
  InventarioInput,
  InventarioStatus,
  InventoryOperationType,
  ListarEscalaRow,
  ProdutividadeConsolidada,
  ProdutividadeInput,
} from '../../types';

// Re-exporta tipos do domínio para uso interno do módulo
export type {
  Cliente,
  Colaborador,
  ColaboradorFuncao,
  EscalaItem,
  EscalaPapel,
  GerarEscalaResult,
  Inventario,
  InventarioInput,
  InventarioStatus,
  InventoryOperationType,
  ListarEscalaRow,
  ProdutividadeConsolidada,
  ProdutividadeInput,
};

// ---------------------------------------------------------------------------
// Constantes de negócio
// ---------------------------------------------------------------------------
export const ESCALA_CONFIG = {
  /** Peso da produtividade no score base */
  PESO_PRODUTIVIDADE: 0.7,
  /** Peso do erro (penalização) no score base */
  PESO_ERRO: 0.3,
  /** Bônus para colaborador da mesma cidade da loja */
  FATOR_LOGISTICO_LOCAL: 1.2,
  /** Sem bônus logístico */
  FATOR_LOGISTICO_EXTERNO: 1.0,
  /** Número fixo de reservas por escala */
  NUM_RESERVAS: 2,
  /** Produtividade padrão para colaboradores novatos (sem histórico) */
  PRODUTIVIDADE_NOVATO_DEFAULT: 500,
  /** Taxa de erro padrão para colaboradores novatos */
  ERRO_NOVATO_DEFAULT_PCT: 0.5,
} as const;

// ---------------------------------------------------------------------------
// Value Objects
// ---------------------------------------------------------------------------

/**
 * Calcula o score final de seleção para um colaborador,
 * incluindo o fator logístico baseado em cidade.
 */
export function calcularScoreFinal(
  produtividadeMedia: number,
  erroMedioPct: number,
  cidadeColaborador: string,
  cidadeCliente: string,
): number {
  const scoreBase =
    produtividadeMedia * ESCALA_CONFIG.PESO_PRODUTIVIDADE -
    erroMedioPct * ESCALA_CONFIG.PESO_ERRO;

  const fatorLogistico =
    cidadeColaborador.trim().toLowerCase() === cidadeCliente.trim().toLowerCase()
      ? ESCALA_CONFIG.FATOR_LOGISTICO_LOCAL
      : ESCALA_CONFIG.FATOR_LOGISTICO_EXTERNO;

  return parseFloat((scoreBase * fatorLogistico).toFixed(4));
}

/**
 * Retorna a composição esperada de uma escala dado o headcount.
 */
export function calcularComposicaoEscala(headcount: number): {
  lideres: number;
  conferentes: number;
  reservas: number;
  total: number;
} {
  return {
    lideres: 1,
    conferentes: headcount,
    reservas: ESCALA_CONFIG.NUM_RESERVAS,
    total: 1 + headcount + ESCALA_CONFIG.NUM_RESERVAS,
  };
}

/**
 * Agrupa os itens da escala por papel para exibição na UI.
 */
export function agruparEscalaPorPapel(escala: ListarEscalaRow[]): {
  lider?: ListarEscalaRow;
  conferentes: ListarEscalaRow[];
  reservas: ListarEscalaRow[];
} {
  return {
    lider: escala.find((e) => e.papel === 'LIDER'),
    conferentes: escala.filter((e) => e.papel === 'CONFERENTE'),
    reservas: escala.filter((e) => e.papel === 'RESERVA'),
  };
}

/**
 * Label legível para o status do inventário.
 */
export const INVENTARIO_STATUS_LABEL: Record<InventarioStatus, string> = {
  AGENDADO:     '📅 Agendado',
  EM_ANDAMENTO: '🔄 Em Andamento',
  CONCLUIDO:    '✅ Concluído',
  CANCELADO:    '❌ Cancelado',
};

/**
 * Label legível para o papel na escala.
 */
export const PAPEL_LABEL: Record<EscalaPapel, string> = {
  LIDER:      '👑 Líder',
  CONFERENTE: '📋 Conferente',
  RESERVA:    '🔄 Reserva',
};
