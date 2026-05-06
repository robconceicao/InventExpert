/**
 * InventExpert — Escala Module
 * service.ts — Camada de serviço / casos de uso
 *
 * Orquestra repositórios, valida regras de negócio e expõe
 * uma API limpa para os controllers/UI consumirem.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ClienteInput,
  ColaboradorInput,
  GerarEscalaResult,
  Inventario,
  InventarioInput,
  ListarEscalaRow,
  ProdutividadeConsolidada,
  ProdutividadeInput,
} from '../../types';
import { EscalaInsuficienteError } from '../../types';

import {
  agruparEscalaPorPapel,
  calcularComposicaoEscala,
  calcularScoreFinal,
  ESCALA_CONFIG,
} from './model';

import {
  ClientesRepository,
  ColaboradoresRepository,
  EscalaRepository,
  InventariosRepository,
  ProdutividadeRepository,
} from './repository';

// ===========================================================================
// SERVICE PRINCIPAL
// ===========================================================================
export class EscalaService {
  private readonly clientesRepo: ClientesRepository;
  private readonly colaboradoresRepo: ColaboradoresRepository;
  private readonly produtividadeRepo: ProdutividadeRepository;
  private readonly inventariosRepo: InventariosRepository;
  private readonly escalaRepo: EscalaRepository;

  constructor(private readonly db: SupabaseClient) {
    this.clientesRepo      = new ClientesRepository(db);
    this.colaboradoresRepo = new ColaboradoresRepository(db);
    this.produtividadeRepo = new ProdutividadeRepository(db);
    this.inventariosRepo   = new InventariosRepository(db);
    this.escalaRepo        = new EscalaRepository(db);
  }

  // -------------------------------------------------------------------------
  // CASO DE USO: Gerar escala automática
  // -------------------------------------------------------------------------
  /**
   * Processa a geração automática de escala para um inventário.
   *
   * Delega o trabalho pesado para a RPC `gerar_escala` no PostgreSQL,
   * que roda em transação e garante atomicidade.
   *
   * @throws EscalaInsuficienteError quando o banco reporta falta de colaboradores
   * @throws Error para outros erros de banco ou rede
   */
  async processarGeracao(inventarioId: string): Promise<GerarEscalaResult> {
    try {
      return await this.escalaRepo.gerarViaRpc(inventarioId);
    } catch (error: any) {
      // Mapeia erros conhecidos do PostgreSQL para erros de negócio tipados
      if (
        error.message.includes('Headcount insuficiente') ||
        error.message.includes('insuficientes para headcount')
      ) {
        throw new EscalaInsuficienteError(error.message);
      }
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // CASO DE USO: Listar escala de um inventário
  // -------------------------------------------------------------------------
  async listarEscala(inventarioId: string): Promise<{
    itens: ListarEscalaRow[];
    agrupado: ReturnType<typeof agruparEscalaPorPapel>;
  }> {
    const data = await this.escalaRepo.listarPorInventario(inventarioId);

    return {
      itens: data,
      agrupado: agruparEscalaPorPapel(data),
    };
  }

  // -------------------------------------------------------------------------
  // CASO DE USO: Confirmar colaborador (check-in)
  // -------------------------------------------------------------------------
  async confirmarColaborador(escalaId: string, confirmado = true): Promise<void> {
    await this.escalaRepo.confirmar(escalaId, confirmado);
  }

  // -------------------------------------------------------------------------
  // CASO DE USO: Buscar inventários
  // -------------------------------------------------------------------------
  async listarInventarios(status?: any): Promise<Inventario[]> {
    return await this.inventariosRepo.listar({ status });
  }

  async buscarInventario(inventarioId: string): Promise<Inventario> {
    const data = await this.inventariosRepo.buscarPorId(inventarioId);
    if (!data) throw new Error('Inventário não encontrado');
    return data;
  }

  // -------------------------------------------------------------------------
  // CASO DE USO: Criar inventário com validação de headcount
  // -------------------------------------------------------------------------
  async criarInventario(input: InventarioInput): Promise<Inventario> {
    if (input.headcount < 1) {
      throw new Error('O headcount deve ser de no mínimo 1 conferente.');
    }
    if (input.headcount > 100) {
      throw new Error('Headcount inválido: máximo de 100 conferentes por inventário.');
    }

    return await this.inventariosRepo.inserir(input);
  }

  // -------------------------------------------------------------------------
  // CASO DE USO: Preview de composição (antes de gerar)
  // -------------------------------------------------------------------------
  /**
   * Retorna quantos colaboradores seriam necessários e quantos estão disponíveis.
   * Útil para mostrar ao usuário antes de disparar a geração.
   */
  async previewComposicao(inventarioId: string): Promise<{
    composicao: ReturnType<typeof calcularComposicaoEscala>;
    lideres_disponiveis: number;
    conferentes_disponiveis: number;
    suficiente: boolean;
    avisos: string[];
  }> {
    const inventario = await this.buscarInventario(inventarioId);
    const composicao = calcularComposicaoEscala(inventario.headcount);

    const consolidado = await this.colaboradoresRepo.listarConsolidado();

    // Nota: esta verificação é simplificada (sem filtro de data).
    // O filtro real de conflito é feito na RPC do banco.
    const lidersDisp    = consolidado.filter((c: ProdutividadeConsolidada) => c.funcao === 'LIDER').length;
    const confDisp      = consolidado.filter((c: ProdutividadeConsolidada) => c.funcao === 'CONFERENTE').length;
    const necessarios   = inventario.headcount + ESCALA_CONFIG.NUM_RESERVAS;
    const suficiente    = lidersDisp >= 1 && confDisp >= necessarios;

    const avisos: string[] = [];
    if (lidersDisp < 1) avisos.push('⚠️ Nenhum Líder ativo cadastrado.');
    if (confDisp < necessarios) {
      avisos.push(
        `⚠️ Apenas ${confDisp} conferentes disponíveis para ${necessarios} necessários (${inventario.headcount} + 2 reservas).`,
      );
    }

    return { composicao, lideres_disponiveis: lidersDisp, conferentes_disponiveis: confDisp, suficiente, avisos };
  }

  // -------------------------------------------------------------------------
  // CASO DE USO: Importar produtividade do InventExp (CSV processado)
  // -------------------------------------------------------------------------
  /**
   * Salva os resultados de avaliação do InventExp como histórico de produtividade.
   * Tenta associar pelo nome (match fuzzy) ou matrícula.
   * Retorna um resumo de quantos foram importados e os não encontrados.
   */
  async importarProdutividadeInventExp(
    registros: ProdutividadeInput[],
  ): Promise<{
    importados: number;
    erros: { colaborador_id: string; motivo: string }[];
  }> {
    const erros: { colaborador_id: string; motivo: string }[] = [];
    const validos: ProdutividadeInput[] = [];

    for (const reg of registros) {
      // Valida dados mínimos
      if (!reg.colaborador_id || !reg.data_inventario) {
        erros.push({ colaborador_id: reg.colaborador_id ?? 'desconhecido', motivo: 'Dados incompletos' });
        continue;
      }
      validos.push(reg);
    }

    if (validos.length === 0) {
      return { importados: 0, erros };
    }

    const count = await this.produtividadeRepo.inserirLote(validos);
    return { importados: count, erros };
  }

  // -------------------------------------------------------------------------
  // CASO DE USO: Ranking de colaboradores (para visualização do líder)
  // -------------------------------------------------------------------------
  async rankingColaboradores(cidadeClienteFiltro?: string): Promise<
    (ProdutividadeConsolidada & { score_final_calculado: number })[]
  > {
    const data = await this.colaboradoresRepo.listarConsolidado();

    return data
      .map((c: ProdutividadeConsolidada) => ({
        ...c,
        score_final_calculado: calcularScoreFinal(
          c.produtividade_media,
          c.erro_medio_pct,
          c.cidade,
          cidadeClienteFiltro ?? '',
        ),
      }))
      .sort((a: any, b: any) => b.score_final_calculado - a.score_final_calculado);
  }

  // -------------------------------------------------------------------------
  // Delegates diretos (para CRUD simples via Controller)
  // -------------------------------------------------------------------------
  readonly clientes = {
    listar: (apenasAtivos?: boolean) => this.clientesRepo.listar({}, apenasAtivos),
    buscarPorId: (id: string) => this.clientesRepo.buscarPorId(id),
    criar: (input: any) => this.clientesRepo.inserir(input),
    atualizar: (id: string, input: any) => this.clientesRepo.actualizar(id, input),
  };

  readonly colaboradores = {
    listar: (apenasAtivos?: boolean) => this.colaboradoresRepo.listar({}, apenasAtivos),
    buscarPorId: (id: string) => this.colaboradoresRepo.buscarPorId(id),
    criar: (input: any) => this.colaboradoresRepo.inserir(input),
    atualizar: (id: string, input: any) =>
      this.colaboradoresRepo.actualizar(id, input),
    listarConsolidado: () => this.colaboradoresRepo.listarConsolidado(),
  };

  readonly produtividade = {
    listarPorColaborador: (id: string, limite?: number) =>
      this.produtividadeRepo.listarPorColaborador(id, limite),
  };
}
