/**
 * InventExpert — Módulo Inventários
 * repository.ts — Acesso directo ao Supabase (sem lógica de negócio)
 *
 * Regras de base:
 *  - NUNCA usar DELETE: cancelamentos são UPDATE de status → 'CANCELADO'
 *  - Listagens filtram status != 'CANCELADO' por omissão
 *  - Joins com clientes para exibição enriquecida
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  IInventario,
  IInventarioFilter,
  IInventarioInput,
  IInventarioStatusUpdate,
  IInventarioUpdate,
} from './types';

const TABELA = 'inventarios' as const;

// Select enriquecido por omissão (join com cliente)
const SELECT_COMPLETO = `
  *,
  clientes (
    id,
    nome,
    cidade,
    estado
  )
` as const;

export class InventariosRepository {
  constructor(private readonly db: SupabaseClient) {}

  // -------------------------------------------------------------------------
  // READ — Listagem com filtros
  // Omite 'CANCELADO' por omissão (equivalente ao ativo = true de outras tabelas)
  // -------------------------------------------------------------------------
  async listar(
    filtros: IInventarioFilter = {},
    incluirCancelados = false,
  ): Promise<IInventario[]> {
    let query = this.db
      .from(TABELA)
      .select(SELECT_COMPLETO)
      .order('data', { ascending: false });

    if (!incluirCancelados && !filtros.status) {
      query = query.neq('status', 'CANCELADO');
    }

    if (filtros.status)       query = query.eq('status', filtros.status);
    if (filtros.cliente_id)   query = query.eq('cliente_id', filtros.cliente_id);
    if (filtros.tipo_operacao) query = query.eq('tipo_operacao', filtros.tipo_operacao);
    if (filtros.data_de)      query = query.gte('data', filtros.data_de);
    if (filtros.data_ate)     query = query.lte('data', filtros.data_ate);

    // Filtro por tipo_agendamento: busca prefixo nas observações
    // até que a migration de coluna separada seja aplicada
    if (filtros.tipo_agendamento) {
      query = query.ilike('observacoes', `[${filtros.tipo_agendamento}]%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao listar inventários: ${error.message}`);
    return (data ?? []) as IInventario[];
  }

  // -------------------------------------------------------------------------
  // READ — Por ID (join completo)
  // -------------------------------------------------------------------------
  async buscarPorId(id: string): Promise<IInventario | null> {
    const { data, error } = await this.db
      .from(TABELA)
      .select(SELECT_COMPLETO)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Erro ao buscar inventário: ${error.message}`);
    return data as IInventario | null;
  }

  // -------------------------------------------------------------------------
  // READ — Inventários de hoje (útil para o dashboard)
  // -------------------------------------------------------------------------
  async buscarHoje(): Promise<IInventario[]> {
    const hoje = new Date().toISOString().slice(0, 10);
    const { data, error } = await this.db
      .from(TABELA)
      .select(SELECT_COMPLETO)
      .eq('data', hoje)
      .neq('status', 'CANCELADO')
      .order('hora_inicio');

    if (error) throw new Error(`Erro ao buscar inventários de hoje: ${error.message}`);
    return (data ?? []) as IInventario[];
  }

  // -------------------------------------------------------------------------
  // READ — Próximos inventários (agenda futura)
  // -------------------------------------------------------------------------
  async buscarProximos(diasAfrente = 30): Promise<IInventario[]> {
    const hoje = new Date().toISOString().slice(0, 10);
    const limite = new Date(Date.now() + diasAfrente * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const { data, error } = await this.db
      .from(TABELA)
      .select(SELECT_COMPLETO)
      .gte('data', hoje)
      .lte('data', limite)
      .neq('status', 'CANCELADO')
      .order('data')
      .order('hora_inicio');

    if (error) throw new Error(`Erro ao buscar próximos inventários: ${error.message}`);
    return (data ?? []) as IInventario[];
  }

  // -------------------------------------------------------------------------
  // CREATE — Inserção com campos pré-processados pela service
  // -------------------------------------------------------------------------
  async inserir(payload: IInventarioInput & { observacoes?: string }): Promise<IInventario> {
    const { data, error } = await this.db
      .from(TABELA)
      .insert({
        ...payload,
        status: 'AGENDADO',  // status inicial sempre AGENDADO
      })
      .select(SELECT_COMPLETO)
      .single();

    if (error) throw new Error(`Erro ao cadastrar inventário: ${error.message}`);
    return data as IInventario;
  }

  // -------------------------------------------------------------------------
  // CREATE LOTE
  // -------------------------------------------------------------------------
  async inserirLote(payloads: (IInventarioInput & { observacoes?: string })[]): Promise<IInventario[]> {
    const list = payloads.map(p => ({
      ...p,
      status: 'AGENDADO',
    }));

    const { data, error } = await this.db
      .from(TABELA)
      .insert(list)
      .select(SELECT_COMPLETO);

    if (error) throw new Error(`Erro ao cadastrar lote de inventários: ${error.message}`);
    return data as IInventario[];
  }

  // -------------------------------------------------------------------------
  // UPDATE — Actualização parcial (campos editáveis)
  // -------------------------------------------------------------------------
  async actualizar(id: string, input: IInventarioUpdate): Promise<IInventario> {
    const { data, error } = await this.db
      .from(TABELA)
      .update(input)
      .eq('id', id)
      .select(SELECT_COMPLETO)
      .single();

    if (error) throw new Error(`Erro ao actualizar inventário: ${error.message}`);
    return data as IInventario;
  }

  // -------------------------------------------------------------------------
  // UPDATE de STATUS
  // -------------------------------------------------------------------------
  async actualizarStatus(
    id: string,
    input: IInventarioStatusUpdate,
  ): Promise<IInventario> {
    const { data, error } = await this.db
      .from(TABELA)
      .update({
        status: input.status,
        ...(input.observacoes ? { observacoes: input.observacoes } : {}),
      })
      .eq('id', id)
      .select(SELECT_COMPLETO)
      .single();

    if (error) throw new Error(`Erro ao actualizar status do inventário: ${error.message}`);
    return data as IInventario;
  }

  // -------------------------------------------------------------------------
  // SOFT DELETE — Cancela o inventário (NUNCA usa DELETE SQL)
  // -------------------------------------------------------------------------
  async cancelar(id: string, motivo?: string): Promise<void> {
    const { error } = await this.db
      .from(TABELA)
      .update({
        status: 'CANCELADO',
        ...(motivo ? { observacoes: `[CANCELADO] ${motivo}` } : {}),
      })
      .eq('id', id);

    if (error) throw new Error(`Erro ao cancelar inventário: ${error.message}`);
  }

  // -------------------------------------------------------------------------
  // VERIFICAR CONFLITO — Mesmo cliente, mesma data, não cancelado
  // -------------------------------------------------------------------------
  async existeConflito(
    clienteId: string,
    data: string,
    excluirId?: string,
  ): Promise<boolean> {
    let query = this.db
      .from(TABELA)
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .eq('data', data)
      .neq('status', 'CANCELADO');

    if (excluirId) query = query.neq('id', excluirId);
    const { count, error } = await query;
    if (error) throw new Error(`Erro ao verificar conflito de data: ${error.message}`);
    return (count ?? 0) > 0;
  }
}
