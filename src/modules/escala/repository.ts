/**
 * InventExpert — Escala Module
 * repository.ts — Camada de acesso a dados via Supabase-js v2
 *
 * Responsabilidade única: comunicação com o banco.
 * Sem lógica de negócio aqui — apenas queries e mapeamentos.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  Cliente,
  ClienteInput,
  Colaborador,
  ColaboradorInput,
  EscalaItem,
  GerarEscalaResult,
  Inventario,
  InventarioInput,
  ListarEscalaRow,
  ProdutividadeConsolidada,
  ProdutividadeInput,
} from '../../types';

// ---------------------------------------------------------------------------
// Tipos auxiliares internos
// ---------------------------------------------------------------------------
type DbResult<T> = { data: T; error: null } | { data: null; error: Error };

function toError(msg: string, supabaseError: unknown): Error {
  const base = supabaseError as { message?: string };
  return new Error(base?.message ?? msg);
}

// ===========================================================================
// CLIENTES REPOSITORY
// ===========================================================================
export class ClientesRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listar(apenasAtivos = true): Promise<DbResult<Cliente[]>> {
    let query = this.db.from('clientes').select('*').order('nome');
    if (apenasAtivos) query = query.eq('ativo', true);
    const { data, error } = await query;
    if (error) return { data: null, error: toError('Erro ao listar clientes', error) };
    return { data: data as Cliente[], error: null };
  }

  async buscarPorId(id: string): Promise<DbResult<Cliente>> {
    const { data, error } = await this.db
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return { data: null, error: toError(`Cliente não encontrado: ${id}`, error) };
    return { data: data as Cliente, error: null };
  }

  async criar(input: ClienteInput): Promise<DbResult<Cliente>> {
    const { data, error } = await this.db
      .from('clientes')
      .insert(input)
      .select()
      .single();
    if (error) return { data: null, error: toError('Erro ao criar cliente', error) };
    return { data: data as Cliente, error: null };
  }

  async atualizar(id: string, input: Partial<ClienteInput>): Promise<DbResult<Cliente>> {
    const { data, error } = await this.db
      .from('clientes')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) return { data: null, error: toError('Erro ao atualizar cliente', error) };
    return { data: data as Cliente, error: null };
  }
}

// ===========================================================================
// COLABORADORES REPOSITORY
// ===========================================================================
export class ColaboradoresRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listar(apenasAtivos = true): Promise<DbResult<Colaborador[]>> {
    let query = this.db.from('colaboradores').select('*').order('nome');
    if (apenasAtivos) query = query.eq('ativo', true);
    const { data, error } = await query;
    if (error) return { data: null, error: toError('Erro ao listar colaboradores', error) };
    return { data: data as Colaborador[], error: null };
  }

  async buscarPorId(id: string): Promise<DbResult<Colaborador>> {
    const { data, error } = await this.db
      .from('colaboradores')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return { data: null, error: toError(`Colaborador não encontrado: ${id}`, error) };
    return { data: data as Colaborador, error: null };
  }

  async buscarPorMatricula(matricula: string): Promise<DbResult<Colaborador>> {
    const { data, error } = await this.db
      .from('colaboradores')
      .select('*')
      .eq('matricula', matricula)
      .single();
    if (error) return { data: null, error: toError(`Matrícula não encontrada: ${matricula}`, error) };
    return { data: data as Colaborador, error: null };
  }

  async criar(input: ColaboradorInput): Promise<DbResult<Colaborador>> {
    const { data, error } = await this.db
      .from('colaboradores')
      .insert(input)
      .select()
      .single();
    if (error) return { data: null, error: toError('Erro ao criar colaborador', error) };
    return { data: data as Colaborador, error: null };
  }

  async atualizar(id: string, input: Partial<ColaboradorInput>): Promise<DbResult<Colaborador>> {
    const { data, error } = await this.db
      .from('colaboradores')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) return { data: null, error: toError('Erro ao atualizar colaborador', error) };
    return { data: data as Colaborador, error: null };
  }

  async listarConsolidado(): Promise<DbResult<ProdutividadeConsolidada[]>> {
    const { data, error } = await this.db
      .from('vw_produtividade_consolidada')
      .select('*')
      .order('score_base', { ascending: false });
    if (error) return { data: null, error: toError('Erro ao buscar consolidado', error) };
    return { data: data as ProdutividadeConsolidada[], error: null };
  }
}

// ===========================================================================
// PRODUTIVIDADE REPOSITORY
// ===========================================================================
export class ProdutividadeRepository {
  constructor(private readonly db: SupabaseClient) {}

  async inserir(input: ProdutividadeInput): Promise<DbResult<{ id: string }>> {
    const { data, error } = await this.db
      .from('produtividade')
      .insert(input)
      .select('id')
      .single();
    if (error) return { data: null, error: toError('Erro ao inserir produtividade', error) };
    return { data: data as { id: string }, error: null };
  }

  async inserirLote(inputs: ProdutividadeInput[]): Promise<DbResult<number>> {
    const { data, error } = await this.db
      .from('produtividade')
      .insert(inputs)
      .select('id');
    if (error) return { data: null, error: toError('Erro ao inserir lote de produtividade', error) };
    return { data: (data ?? []).length, error: null };
  }

  async listarPorColaborador(
    colaboradorId: string,
    limite = 20,
  ): Promise<DbResult<ProdutividadeInput[]>> {
    const { data, error } = await this.db
      .from('produtividade')
      .select('*')
      .eq('colaborador_id', colaboradorId)
      .order('data_inventario', { ascending: false })
      .limit(limite);
    if (error) return { data: null, error: toError('Erro ao listar produtividade', error) };
    return { data: data as ProdutividadeInput[], error: null };
  }
}

// ===========================================================================
// INVENTARIOS REPOSITORY
// ===========================================================================
export class InventariosRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listar(status?: string): Promise<DbResult<Inventario[]>> {
    let query = this.db
      .from('inventarios')
      .select('*, clientes(id, nome, cidade, estado)')
      .order('data', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return { data: null, error: toError('Erro ao listar inventários', error) };
    return { data: data as Inventario[], error: null };
  }

  async buscarPorId(id: string): Promise<DbResult<Inventario>> {
    const { data, error } = await this.db
      .from('inventarios')
      .select('*, clientes(id, nome, cidade, estado)')
      .eq('id', id)
      .single();
    if (error) return { data: null, error: toError(`Inventário não encontrado: ${id}`, error) };
    return { data: data as Inventario, error: null };
  }

  async criar(input: InventarioInput): Promise<DbResult<Inventario>> {
    const { data, error } = await this.db
      .from('inventarios')
      .insert(input)
      .select('*, clientes(id, nome, cidade, estado)')
      .single();
    if (error) return { data: null, error: toError('Erro ao criar inventário', error) };
    return { data: data as Inventario, error: null };
  }

  async atualizarStatus(id: string, status: string): Promise<DbResult<void>> {
    const { error } = await this.db
      .from('inventarios')
      .update({ status })
      .eq('id', id);
    if (error) return { data: null, error: toError('Erro ao atualizar status do inventário', error) };
    return { data: undefined, error: null };
  }
}

// ===========================================================================
// ESCALA REPOSITORY
// ===========================================================================
export class EscalaRepository {
  constructor(private readonly db: SupabaseClient) {}

  /**
   * Dispara a RPC `gerar_escala` no banco.
   * O motor SQL faz todo o trabalho em uma transação.
   */
  async gerarViaRpc(inventarioId: string): Promise<DbResult<GerarEscalaResult>> {
    const { data, error } = await this.db
      .rpc('gerar_escala', { p_inventario_id: inventarioId });
    if (error) return { data: null, error: toError(`Falha ao gerar escala: ${error.message}`, error) };
    return { data: data as GerarEscalaResult, error: null };
  }

  /**
   * Lista a escala de um inventário com dados completos dos colaboradores.
   * Usa a RPC `listar_escala` que retorna join otimizado.
   */
  async listarPorInventario(inventarioId: string): Promise<DbResult<ListarEscalaRow[]>> {
    const { data, error } = await this.db
      .rpc('listar_escala', { p_inventario_id: inventarioId });
    if (error) return { data: null, error: toError('Erro ao listar escala', error) };
    return { data: data as ListarEscalaRow[], error: null };
  }

  /**
   * Confirma a presença de um colaborador na escala (check-in).
   */
  async confirmar(escalaId: string, confirmado = true): Promise<DbResult<void>> {
    const { error } = await this.db
      .from('escala')
      .update({ confirmado })
      .eq('id', escalaId);
    if (error) return { data: null, error: toError('Erro ao confirmar colaborador', error) };
    return { data: undefined, error: null };
  }

  async listarBruto(inventarioId: string): Promise<DbResult<EscalaItem[]>> {
    const { data, error } = await this.db
      .from('escala')
      .select('*, colaboradores(id, nome, funcao, cidade, matricula)')
      .eq('inventario_id', inventarioId)
      .order('papel');
    if (error) return { data: null, error: toError('Erro ao listar escala bruta', error) };
    return { data: data as EscalaItem[], error: null };
  }
}
