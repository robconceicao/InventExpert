/**
 * InventExpert — Módulo Clientes
 * repository.ts — Acesso directo ao Supabase (sem lógica de negócio)
 *
 * Regras de base:
 *  - NUNCA usar DELETE: exclusões são soft delete (ativo = false)
 *  - Listagens filtram ativo = true por omissão
 *  - UUID gerado pelo banco (uuid_generate_v4) na tabela
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ICliente, IClienteFilter, IClienteInput, IClienteUpdate } from './types';

const TABELA = 'clientes' as const;

export class ClientesRepository {
  constructor(private readonly db: SupabaseClient) {}

  // -------------------------------------------------------------------------
  // READ — Listagem com filtro ativo = true por omissão
  // -------------------------------------------------------------------------
  async listar(
    filtros: IClienteFilter = {},
    apenasAtivos = true,
  ): Promise<ICliente[]> {
    let query = this.db
      .from(TABELA)
      .select('*')
      .order('nome', { ascending: true });

    if (apenasAtivos) {
      query = query.eq('ativo', true);
    }

    // Filtros opcionais
    if (filtros.cidade)   query = query.ilike('cidade', `%${filtros.cidade}%`);
    if (filtros.estado)   query = query.eq('estado', filtros.estado.toUpperCase());
    if (filtros.segmento) query = query.eq('segmento', filtros.segmento);
    if (filtros.busca) {
      // Busca por nome OU codigo_loja (se existir na tabela)
      query = query.or(
        `nome.ilike.%${filtros.busca}%,codigo_loja.ilike.%${filtros.busca}%`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao listar clientes: ${error.message}`);
    return (data ?? []) as ICliente[];
  }

  // -------------------------------------------------------------------------
  // READ — Por ID
  // -------------------------------------------------------------------------
  async buscarPorId(id: string): Promise<ICliente | null> {
    const { data, error } = await this.db
      .from(TABELA)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Erro ao buscar cliente: ${error.message}`);
    return data as ICliente | null;
  }

  // -------------------------------------------------------------------------
  // READ — Por código de loja (unique)
  // -------------------------------------------------------------------------
  async buscarPorCodigo(codigoLoja: string): Promise<ICliente | null> {
    const { data, error } = await this.db
      .from(TABELA)
      .select('*')
      .eq('codigo_loja', String(codigoLoja).trim())
      .maybeSingle();

    if (error) throw new Error(`Erro ao buscar por código de loja: ${error.message}`);
    return data as ICliente | null;
  }

  // -------------------------------------------------------------------------
  // CREATE — Insere com UUID gerado pelo banco
  // -------------------------------------------------------------------------
  async inserir(input: IClienteInput): Promise<ICliente> {
    const payload = {
      ...input,
      // codigo_loja sempre como string, sem espaços
      codigo_loja: input.codigo_loja ? String(input.codigo_loja).trim() : undefined,
      ativo: true,  // sempre true ao criar
    };

    const { data, error } = await this.db
      .from(TABELA)
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Erro ao cadastrar cliente: ${error.message}`);
    return data as ICliente;
  }

  // -------------------------------------------------------------------------
  // CREATE LOTE — Insere múltiplos clientes (upsert baseado no codigo_loja)
  // -------------------------------------------------------------------------
  async inserirLote(inputs: IClienteInput[]): Promise<ICliente[]> {
    const payloads = inputs.map(input => ({
      ...input,
      nome: input.nome.trim(),
      cidade: input.cidade.trim(),
      estado: input.estado.toUpperCase(),
      codigo_loja: input.codigo_loja ? String(input.codigo_loja).trim() : null,
      ativo: true,
    }));

    const { data, error } = await this.db
      .from(TABELA)
      .upsert(payloads, { onConflict: 'codigo_loja', ignoreDuplicates: false })
      .select();

    if (error) throw new Error(`Erro ao cadastrar lote de clientes: ${error.message}`);
    return data as ICliente[];
  }

  // -------------------------------------------------------------------------
  // UPDATE — Actualização parcial
  // -------------------------------------------------------------------------
  async actualizar(id: string, input: IClienteUpdate): Promise<ICliente> {
    const { data, error } = await this.db
      .from(TABELA)
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Erro ao actualizar cliente: ${error.message}`);
    return data as ICliente;
  }

  // -------------------------------------------------------------------------
  // SOFT DELETE — Nunca apaga; apenas desactiva
  // -------------------------------------------------------------------------
  async desativar(id: string): Promise<void> {
    const { error } = await this.db
      .from(TABELA)
      .update({ ativo: false })
      .eq('id', id);

    if (error) throw new Error(`Erro ao desactivar cliente: ${error.message}`);
  }

  // -------------------------------------------------------------------------
  // REACTIVAR (operação administrativa)
  // -------------------------------------------------------------------------
  async reativar(id: string): Promise<void> {
    const { error } = await this.db
      .from(TABELA)
      .update({ ativo: true })
      .eq('id', id);

    if (error) throw new Error(`Erro ao reactivar cliente: ${error.message}`);
  }

  // -------------------------------------------------------------------------
  // VERIFICAR EXISTÊNCIA (para validações de unicidade)
  // -------------------------------------------------------------------------
  async existeCodigo(codigoLoja: string, excluirId?: string): Promise<boolean> {
    let query = this.db
      .from(TABELA)
      .select('id', { count: 'exact', head: true })
      .eq('codigo_loja', String(codigoLoja).trim());

    if (excluirId) query = query.neq('id', excluirId);
    const { count, error } = await query;
    if (error) throw new Error(`Erro ao verificar código de loja: ${error.message}`);
    return (count ?? 0) > 0;
  }
}
