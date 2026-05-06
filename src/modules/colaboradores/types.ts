/**
 * InventExpert — Módulo Colaboradores
 * types.ts — Extensão local das interfaces do domínio
 *
 * Compatível com o schema_v2.sql.
 * NOTA: O campo telefone requer a migration
 *       supabase/migrations/add_colaboradores_extra_fields.sql
 */

import type { Colaborador, ColaboradorFuncao, ColaboradorInput, ICrudResult } from '../../types';

// ---------------------------------------------------------------------------
// Re-exporta do domínio para conveniência interna
// ---------------------------------------------------------------------------
export type { ColaboradorFuncao };

/** IColaborador — interface completa com campos adicionais de negócio */
export interface IColaborador extends Colaborador {
  /** Contacto telefónico / WhatsApp. Requer migration. */
  telefone?: string;
  /** Data de nascimento (para cálculo de senioridade). Requer migration. */
  data_nascimento?: string;
}

/** Input para criação — campos obrigatórios de negócio */
export interface IColaboradorInput extends Omit<ColaboradorInput, 'ativo'> {
  /** Telefone / WhatsApp (obrigatório por regra de negócio) */
  telefone?: string;
  /** Data de nascimento ISO (opcional) */
  data_nascimento?: string;
  /** Sempre true em criação */
  ativo?: boolean;
}

/** Input para actualização parcial */
export type IColaboradorUpdate = Partial<
  Omit<IColaboradorInput, 'ativo'>
>;

/** Filtros para listagem */
export interface IColaboradorFilter {
  funcao?: ColaboradorFuncao;
  cidade?: string;
  estado?: string;
  busca?: string; // por nome ou matrícula
}

/** Resposta padronizada */
export type { ICrudResult };
