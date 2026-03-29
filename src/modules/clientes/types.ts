/**
 * InventExpert — Módulo Clientes
 * types.ts — Extensão local das interfaces do domínio
 *
 * Compatível com o schema_v2.sql.
 * NOTA: Os campos telefone e codigo_loja requerem a migration
 *       supabase/migrations/add_clientes_extra_fields.sql
 */

import type { Cliente, ClienteInput } from '../../types';

// ---------------------------------------------------------------------------
// Extensão com campos adicionais (requerem migration)
// ---------------------------------------------------------------------------

/** ICliente — interface completa com campos adicionais de negócio */
export interface ICliente extends Cliente {
  /** Código único da loja (ex: "SP-001"). Requer migration. */
  codigo_loja?: string;
  /** Contacto telefónico da loja. Requer migration. */
  telefone?: string;
  /** Segmento de negócio */
  segmento?: 'FARMACIA' | 'SUPERMERCADO' | 'LOJA_GERAL';
}

/** Input para criação — omite campos gerados automaticamente */
export interface IClienteInput extends Omit<ClienteInput, never> {
  nome: string;
  cidade: string;
  estado: string;
  endereco?: string;
  codigo_loja?: string;
  telefone?: string;
  segmento?: ICliente['segmento'];
  /** Sempre true em criação. gestão via softDelete. */
  ativo?: boolean;
}

/** Input para actualização parcial */
export type IClienteUpdate = Partial<Omit<IClienteInput, 'ativo'>>;

/** Filtros para listagem */
export interface IClienteFilter {
  cidade?: string;
  segmento?: ICliente['segmento'];
  estado?: string;
  busca?: string; // busca por nome ou codigo_loja
}

/** Resposta padronizada de todas as operações */
export interface ICrudResult<T = void> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}
