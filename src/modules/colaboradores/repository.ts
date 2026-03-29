/**
 * InventExpert — Módulo Colaboradores
 * repository.ts — Acesso directo ao Supabase (sem lógica de negócio)
 *
 * Regras de base:
 *  - NUNCA usar DELETE: exclusões são soft delete (ativo = false)
 *  - Listagens filtram ativo = true por omissão
 *  - Matrícula é única quando fornecida
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  IColaborador,
  IColaboradorFilter,
  IColaboradorInput,
  IColaboradorUpdate,
} from './types';

const TABELA = 'colaboradores' as const;

export class ColaboradoresRepository {
  constructor(private readonly db: SupabaseClient) {}

  // -------------------------------------------------------------------------
  // READ — Listagem com filtro ativo = true por omissão
  // -------------------------------------------------------------------------
  async listar(
    filtros: IColaboradorFilter = {},
    apenasAtivos = true,
  ): Promise<IColaborador[]> {
    let query = this.db
      .from(TABELA)
      .select('*')
      .order('nome', { ascending: true });

    if (apenasAtivos) {
      query = query.eq('ativo', true);
    }

    if (filtros.funcao)  query = query.eq('funcao', filtros.funcao);
    if (filtros.cidade)  query = query.ilike('cidade', `%${filtros.cidade}%`);
    if (filtros.estado)  query = query.eq('estado', filtros.estado.toUpperCase());
    if (filtros.busca) {
      // Busca por nome OU matrícula
      query = query.or(
        `nome.ilike.%${filtros.busca}%,matricula.ilike.%${filtros.busca}%`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao listar colaboradores: ${error.message}`);
    return (data ?? []) as IColaborador[];
  }

  // -------------------------------------------------------------------------
  // READ — Por ID
  // -------------------------------------------------------------------------
  async buscarPorId(id: string): Promise<IColaborador | null> {
    const { data, error } = await this.db
      .from(TABELA)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Erro ao buscar colaborador: ${error.message}`);
    return data as IColaborador | null;
  }

  // -------------------------------------------------------------------------
  // READ — Por matrícula
  // -------------------------------------------------------------------------
  async buscarPorMatricula(matricula: string): Promise<IColaborador | null> {
    const { data, error } = await this.db
      .from(TABELA)
      .select('*')
      .eq('matricula', String(matricula).trim())
      .maybeSingle();

    if (error) throw new Error(`Erro ao buscar por matrícula: ${error.message}`);
    return data as IColaborador | null;
  }

  // -------------------------------------------------------------------------
  // READ — Apenas activos de uma função, ordenados por cidade
  // (usado pelo motor de escalas para preview)
  // -------------------------------------------------------------------------
  async listarPorFuncao(
    funcao: IColaborador['funcao'],
    cidade?: string,
  ): Promise<IColaborador[]> {
    let query = this.db
      .from(TABELA)
      .select('*')
      .eq('funcao', funcao)
      .eq('ativo', true)
      .order('cidade')
      .order('nome');

    if (cidade) query = query.eq('cidade', cidade);

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao listar por função: ${error.message}`);
    return (data ?? []) as IColaborador[];
  }

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------
  async inserir(input: IColaboradorInput): Promise<IColaborador> {
    const payload = {
      ...input,
      estado: input.estado.toUpperCase().substring(0, 2),
      ativo: true,
    };

    const { data, error } = await this.db
      .from(TABELA)
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Erro ao cadastrar colaborador: ${error.message}`);
    return data as IColaborador;
  }

  // -------------------------------------------------------------------------
  // UPDATE — Actualização parcial
  // -------------------------------------------------------------------------
  async actualizar(id: string, input: IColaboradorUpdate): Promise<IColaborador> {
    const payload = {
      ...input,
      ...(input.estado ? { estado: input.estado.toUpperCase().substring(0, 2) } : {}),
    };

    const { data, error } = await this.db
      .from(TABELA)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Erro ao actualizar colaborador: ${error.message}`);
    return data as IColaborador;
  }

  // -------------------------------------------------------------------------
  // SOFT DELETE — Desactiva (nunca apaga)
  // -------------------------------------------------------------------------
  async desativar(id: string): Promise<void> {
    const { error } = await this.db
      .from(TABELA)
      .update({ ativo: false })
      .eq('id', id);

    if (error) throw new Error(`Erro ao desactivar colaborador: ${error.message}`);
  }

  // -------------------------------------------------------------------------
  // REACTIVAR
  // -------------------------------------------------------------------------
  async reativar(id: string): Promise<void> {
    const { error } = await this.db
      .from(TABELA)
      .update({ ativo: true })
      .eq('id', id);

    if (error) throw new Error(`Erro ao reactivar colaborador: ${error.message}`);
  }

  // -------------------------------------------------------------------------
  // VERIFICAR UNICIDADE — Matrícula
  // -------------------------------------------------------------------------
  async existeMatricula(matricula: string, excluirId?: string): Promise<boolean> {
    let query = this.db
      .from(TABELA)
      .select('id', { count: 'exact', head: true })
      .eq('matricula', String(matricula).trim());

    if (excluirId) query = query.neq('id', excluirId);
    const { count, error } = await query;
    if (error) throw new Error(`Erro ao verificar matrícula: ${error.message}`);
    return (count ?? 0) > 0;
  }

  // -------------------------------------------------------------------------
  // CONTAGEM — Para relatórios
  // -------------------------------------------------------------------------
  async contar(apenasAtivos = true): Promise<number> {
    let query = this.db
      .from(TABELA)
      .select('id', { count: 'exact', head: true });
    if (apenasAtivos) query = query.eq('ativo', true);
    const { count, error } = await query;
    if (error) throw new Error(`Erro ao contar colaboradores: ${error.message}`);
    return count ?? 0;
  }
}
