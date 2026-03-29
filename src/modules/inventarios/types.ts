/**
 * InventExpert — Módulo Inventários
 * types.ts — Extensão local das interfaces do domínio
 *
 * Compatível com o schema_v2.sql.
 * A classificação "janela" / "fixo" é calculada na service
 * e persistida como prefixo nas observações até que a migration
 * supabase/migrations/add_inventarios_tipo_janela.sql seja aplicada.
 */

import type {
  Inventario,
  InventarioInput,
  InventarioStatus,
  InventoryOperationType,
} from '../../types';

// ---------------------------------------------------------------------------
// Re-exporta para conveniência
// ---------------------------------------------------------------------------
export type { InventarioStatus, InventoryOperationType };

/**
 * Tipo do agendamento:
 *  - JANELA: inventário urgente — data dentro de 7 dias a partir de hoje.
 *  - FIXO:   inventário planeado — data com mais de 7 dias de antecedência.
 */
export type TipoAgendamento = 'JANELA' | 'FIXO';

/** IInventario — interface completa */
export interface IInventario extends Inventario {
  /**
   * Tipo de agendamento calculado automaticamente na criação.
   * Persistido como campo quando a migration for aplicada.
   * Até lá, presente as observações como "[JANELA]" ou "[FIXO]".
   */
  tipo_agendamento?: TipoAgendamento;
}

/** Input para criação */
export interface IInventarioInput {
  cliente_id: string;
  /** Data do inventário no formato ISO (YYYY-MM-DD) */
  data: string;
  hora_inicio?: string;
  tipo_operacao: InventoryOperationType;
  /** Número de conferentes necessários (mín. 1, máx. 100) */
  headcount: number;
  observacoes?: string;
  /** Gerado pelo backend auth context se omitido */
  created_by?: string;
}

/** Input para actualização parcial */
export type IInventarioUpdate = Partial<
  Pick<IInventarioInput, 'hora_inicio' | 'headcount' | 'observacoes' | 'tipo_operacao'>
>;

/** Input para mudança de status */
export interface IInventarioStatusUpdate {
  status: InventarioStatus;
  observacoes?: string;
}

/** Filtros para listagem */
export interface IInventarioFilter {
  cliente_id?: string;
  status?: InventarioStatus;
  tipo_operacao?: InventoryOperationType;
  tipo_agendamento?: TipoAgendamento;
  data_de?: string;  // ISO date
  data_ate?: string; // ISO date
}

/** Resposta padronizada */
export interface ICrudResult<T = void> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}
