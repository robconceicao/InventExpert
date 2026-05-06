/**
 * InventExpert — Escala Module
 * repository.ts — Camada de acesso a dados via Supabase-js v2
 *
 * Responsabilidade única: comunicação com o banco para o motor de escalas.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  EscalaItem,
  GerarEscalaResult,
  ListarEscalaRow,
} from '../../types';

// Re-exportamos os repositórios dos outros módulos para manter compatibilidade de importação
export { ClientesRepository } from '../clientes/repository';
export { ColaboradoresRepository } from '../colaboradores/repository';
export { InventariosRepository } from '../inventarios/repository';
// ProdutividadeRepository ainda reside no domínio ou escala por enquanto se não houver módulo específico
// Mas vamos mantê-lo aqui ou mover se existir um módulo. 
// Como não vi um módulo src/modules/produtividade, vou mantê-lo aqui por enquanto ou verificar se existe.

// ===========================================================================
// ESCALA REPOSITORY
// ===========================================================================
export class EscalaRepository {
  constructor(private readonly db: SupabaseClient) {}

  /**
   * Dispara a RPC `gerar_escala` no banco.
   */
  async gerarViaRpc(inventarioId: string): Promise<GerarEscalaResult> {
    const { data, error } = await this.db
      .rpc('gerar_escala', { p_inventario_id: inventarioId });
    
    if (error) throw new Error(`Falha ao gerar escala: ${error.message}`);
    return data as GerarEscalaResult;
  }

  /**
   * Lista a escala de um inventário com dados completos dos colaboradores.
   */
  async listarPorInventario(inventarioId: string): Promise<ListarEscalaRow[]> {
    const { data, error } = await this.db
      .rpc('listar_escala', { p_inventario_id: inventarioId });
    
    if (error) throw new Error(`Erro ao listar escala: ${error.message}`);
    return (data ?? []) as ListarEscalaRow[];
  }

  /**
   * Confirma a presença de um colaborador na escala (check-in).
   */
  async confirmar(escalaId: string, confirmado = true): Promise<void> {
    const { error } = await this.db
      .from('escala')
      .update({ confirmado })
      .eq('id', escalaId);
    
    if (error) throw new Error(`Erro ao confirmar colaborador: ${error.message}`);
  }

  async listarBruto(inventarioId: string): Promise<EscalaItem[]> {
    const { data, error } = await this.db
      .from('escala')
      .select('*, colaboradores(id, nome, funcao, cidade, matricula)')
      .eq('inventario_id', inventarioId)
      .order('papel');
    
    if (error) throw new Error(`Erro ao listar escala bruta: ${error.message}`);
    return (data ?? []) as EscalaItem[];
  }
}

// ProdutividadeRepository - Mantido aqui se não houver módulo próprio
import type { ProdutividadeInput } from '../../types';

export class ProdutividadeRepository {
  constructor(private readonly db: SupabaseClient) {}

  async inserir(input: ProdutividadeInput): Promise<{ id: string }> {
    const { data, error } = await this.db
      .from('produtividade')
      .insert(input)
      .select('id')
      .single();
    if (error) throw new Error(`Erro ao inserir produtividade: ${error.message}`);
    return data as { id: string };
  }

  async inserirLote(inputs: ProdutividadeInput[]): Promise<number> {
    const { data, error } = await this.db
      .from('produtividade')
      .insert(inputs)
      .select('id');
    if (error) throw new Error(`Erro ao inserir lote de produtividade: ${error.message}`);
    return (data ?? []).length;
  }

  async listarPorColaborador(
    colaboradorId: string,
    limite = 20,
  ): Promise<ProdutividadeInput[]> {
    const { data, error } = await this.db
      .from('produtividade')
      .select('*')
      .eq('colaborador_id', colaboradorId)
      .order('data_inventario', { ascending: false })
      .limit(limite);
    if (error) throw new Error(`Erro ao listar produtividade: ${error.message}`);
    return (data ?? []) as ProdutividadeInput[];
  }
}
