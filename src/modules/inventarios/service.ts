/**
 * InventExpert — Módulo Inventários
 * service.ts — Lógica de negócio e validações
 *
 * Regras de negócio específicas:
 *  1. Calcular automaticamente tipo_agendamento:
 *       JANELA → data dentro de 7 dias a partir de hoje
 *       FIXO   → data com mais de 7 dias de antecedência
 *  2. Detectar conflito: mesmo cliente + mesma data
 *  3. Soft delete: cancelamento via status = 'CANCELADO'
 *  4. Headcount: mín. 1, máx. 100
 *  5. Data: não pode ser retroativa (anteriores a hoje)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { InventariosRepository } from './repository';
import type {
  ICrudResult,
  IInventario,
  IInventarioFilter,
  IInventarioInput,
  IInventarioStatusUpdate,
  IInventarioUpdate,
  InventarioStatus,
  TipoAgendamento,
} from './types';

// ---------------------------------------------------------------------------
// Regra de negócio: cálculo do tipo de agendamento
// ---------------------------------------------------------------------------

const DIAS_LIMITE_JANELA = 7;

/**
 * Calcula o tipo do agendamento com base na data.
 * JANELA: urgente (≤ 7 dias).
 * FIXO: planeado (> 7 dias de antecedência).
 */
function calcularTipoAgendamento(dataIso: string): TipoAgendamento {
  const hoje    = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataInv = new Date(dataIso + 'T00:00:00');
  const diffMs  = dataInv.getTime() - hoje.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDias <= DIAS_LIMITE_JANELA ? 'JANELA' : 'FIXO';
}

/**
 * Prefixa as observações com o tipo de agendamento.
 * Ex: "[JANELA] Inventário urgente" ou "[FIXO] Agendado com antecedência"
 */
function prefixarObservacoes(
  tipo: TipoAgendamento,
  observacoes?: string,
): string {
  const tag = `[${tipo}]`;
  if (!observacoes?.trim()) return tag;
  if (observacoes.startsWith('[JANELA]') || observacoes.startsWith('[FIXO]')) {
    return observacoes; // já tem tag, não duplica
  }
  return `${tag} ${observacoes.trim()}`;
}

// ---------------------------------------------------------------------------
// Validações
// ---------------------------------------------------------------------------

function validarData(dataIso: string): string | null {
  if (!dataIso?.trim()) return 'A data do inventário é obrigatória.';

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dataIso)) {
    return 'Formato de data inválido. Use YYYY-MM-DD.';
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataInv = new Date(dataIso + 'T00:00:00');

  if (isNaN(dataInv.getTime())) {
    return 'Data inválida.';
  }
  if (dataInv < hoje) {
    return 'Não é possível agendar um inventário em data retroativa.';
  }
  return null;
}

function validarHeadcount(headcount: number): string | null {
  if (!Number.isInteger(headcount) || headcount < 1) {
    return 'O headcount deve ser um número inteiro de pelo menos 1 conferente.';
  }
  if (headcount > 100) {
    return 'O headcount não pode exceder 100 conferentes por inventário.';
  }
  return null;
}

// ===========================================================================
// SERVICE
// ===========================================================================
export class InventariosService {
  private readonly repo: InventariosRepository;

  constructor(db: SupabaseClient) {
    this.repo = new InventariosRepository(db);
  }

  // -------------------------------------------------------------------------
  // LISTAR
  // -------------------------------------------------------------------------
  async listar(
    filtros: IInventarioFilter = {},
    incluirCancelados = false,
  ): Promise<ICrudResult<IInventario[]>> {
    try {
      const dados = await this.repo.listar(filtros, incluirCancelados);
      // Decora cada item com o tipo_agendamento calculado
      const decorados = dados.map((inv) => ({
        ...inv,
        tipo_agendamento: calcularTipoAgendamento(inv.data),
      }));
      return { sucesso: true, dados: decorados };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao listar inventários.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // BUSCAR POR ID
  // -------------------------------------------------------------------------
  async buscarPorId(id: string): Promise<ICrudResult<IInventario>> {
    try {
      if (!id?.trim()) {
        return { sucesso: false, erro: 'ID do inventário é obrigatório.' };
      }
      const dados = await this.repo.buscarPorId(id);
      if (!dados) {
        return { sucesso: false, erro: 'Inventário não encontrado.' };
      }
      return {
        sucesso: true,
        dados: { ...dados, tipo_agendamento: calcularTipoAgendamento(dados.data) },
      };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao buscar inventário.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // HOJE e PRÓXIMOS (para dashboard)
  // -------------------------------------------------------------------------
  async buscarHoje(): Promise<ICrudResult<IInventario[]>> {
    try {
      const dados = await this.repo.buscarHoje();
      return { sucesso: true, dados };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao buscar inventários de hoje.',
      };
    }
  }

  async buscarProximos(dias = 30): Promise<ICrudResult<IInventario[]>> {
    try {
      const dados = await this.repo.buscarProximos(dias);
      const decorados = dados.map((inv) => ({
        ...inv,
        tipo_agendamento: calcularTipoAgendamento(inv.data),
      }));
      return { sucesso: true, dados: decorados };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao buscar próximos inventários.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // CADASTRAR
  // Calcula automaticamente tipo_agendamento e detecta conflitos
  // -------------------------------------------------------------------------
  async cadastrar(input: IInventarioInput): Promise<ICrudResult<IInventario>> {
    try {
      // Validações
      if (!input.cliente_id?.trim()) {
        return { sucesso: false, erro: 'O cliente é obrigatório.' };
      }

      const erroData = validarData(input.data);
      if (erroData) return { sucesso: false, erro: erroData };

      const erroHead = validarHeadcount(input.headcount);
      if (erroHead) return { sucesso: false, erro: erroHead };

      if (!input.tipo_operacao) {
        return {
          sucesso: false,
          erro: 'O tipo de operação é obrigatório (FARMACIA, SUPERMERCADO ou LOJA_GERAL).',
        };
      }

      // Verificar conflito de data para o mesmo cliente
      const conflito = await this.repo.existeConflito(input.cliente_id, input.data);
      if (conflito) {
        return {
          sucesso: false,
          erro: `Já existe um inventário agendado para este cliente na data ${input.data}. Cancele o anterior antes de criar um novo.`,
        };
      }

      // Calcular tipo de agendamento automaticamente
      const tipoAgendamento = calcularTipoAgendamento(input.data);
      const observacoesComTag = prefixarObservacoes(tipoAgendamento, input.observacoes);

      const dados = await this.repo.inserir({
        ...input,
        observacoes: observacoesComTag,
      });

      return {
        sucesso: true,
        dados: { ...dados, tipo_agendamento: tipoAgendamento },
      };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro inesperado ao cadastrar inventário.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // CREATE LOTE (IMPORTAÇÃO VIA EXCEL)
  // -------------------------------------------------------------------------
  async inserirLoteExcel(
    linhas: { codigo_loja?: string; data?: string; headcount?: number; piv?: number; hora_inicio?: string; observacoes?: string }[]
  ): Promise<ICrudResult<number>> {
    try {
      if (!linhas || linhas.length === 0) {
        return { sucesso: false, erro: 'A planilha parece estar vazia.' };
      }

      // 1. Extrair os códigos únicos
      const codigos = [...new Set(linhas.map(L => String(L.codigo_loja || '').trim()).filter(Boolean))];
      if (codigos.length === 0) {
        return { sucesso: false, erro: 'Nenhuma coluna "codigo_loja" encontrada.' };
      }

      // 2. Buscar na base (usando o objeto db exposto temporariamente via cast, seguro pois repo encapsula a mesmância)
      const db = (this.repo as any).db as SupabaseClient;
      const { data: clientesData, error: cliError } = await db
        .from('clientes')
        .select('id, codigo_loja')
        .in('codigo_loja', codigos)
        .eq('ativo', true);

      if (cliError) throw new Error('Erro ao validar lojas: ' + cliError.message);

      const mapaClientes = new Map<string, string>();
      (clientesData || []).forEach(c => {
        if (c.codigo_loja) mapaClientes.set(String(c.codigo_loja).trim(), c.id);
      });

      // 3. Montar payloads válidos
      const payloads: (IInventarioInput & { observacoes?: string })[] = [];
      let ignorados = 0;

      for (const linha of linhas) {
        const codigo = String(linha.codigo_loja || '').trim();
        const clienteId = mapaClientes.get(codigo);
        if (!clienteId) { ignorados++; continue; } // Loja não cadastrada

        const dataInv = linha.data || '';
        if (validarData(dataInv)) { ignorados++; continue; }

        const hc = Number(linha.headcount) || Number(linha.piv) || 0;
        if (validarHeadcount(hc)) { ignorados++; continue; }

        const tipoAgendamento = calcularTipoAgendamento(dataInv);
        const obs = prefixarObservacoes(tipoAgendamento, linha.observacoes);

        payloads.push({
          cliente_id: clienteId,
          data: dataInv,
          headcount: hc,
          tipo_operacao: 'FARMACIA', // Padrão
          hora_inicio: linha.hora_inicio || undefined,
          observacoes: obs,
        });
      }

      if (payloads.length === 0) {
        return { sucesso: false, erro: 'Nenhum registro válido. Lojas não cadastradas ou datas inválidas/retroativas.' };
      }

      const dados = await this.repo.inserirLote(payloads);
      
      return { 
        sucesso: true, 
        dados: dados.length, 
        // Se houve ignorados, passamos via mensagem de erro amigável na UI
        ...(ignorados > 0 && { erro: `Importados ${dados.length}. Porém, ${ignorados} linhas foram ignoradas (Loja não cadastrada ou dados incorretos).` })
      };
    } catch (e) {
      return { sucesso: false, erro: e instanceof Error ? e.message : 'Erro na importação.' };
    }
  }

  // -------------------------------------------------------------------------
  // ACTUALIZAR
  // -------------------------------------------------------------------------
  async actualizar(
    id: string,
    input: IInventarioUpdate,
  ): Promise<ICrudResult<IInventario>> {
    try {
      if (!id?.trim()) {
        return { sucesso: false, erro: 'ID do inventário é obrigatório.' };
      }

      const existente = await this.repo.buscarPorId(id);
      if (!existente) {
        return { sucesso: false, erro: 'Inventário não encontrado.' };
      }
      if (existente.status === 'CANCELADO') {
        return { sucesso: false, erro: 'Não é possível editar um inventário cancelado.' };
      }
      if (existente.status === 'CONCLUIDO') {
        return { sucesso: false, erro: 'Não é possível editar um inventário já concluído.' };
      }

      if (input.headcount !== undefined) {
        const erroHead = validarHeadcount(input.headcount);
        if (erroHead) return { sucesso: false, erro: erroHead };
      }

      const dados = await this.repo.actualizar(id, input);
      return {
        sucesso: true,
        dados: { ...dados, tipo_agendamento: calcularTipoAgendamento(dados.data) },
      };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao actualizar inventário.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // MUDAR STATUS (ex: AGENDADO → EM_ANDAMENTO → CONCLUIDO)
  // -------------------------------------------------------------------------
  async atualizarStatus(
    id: string,
    input: IInventarioStatusUpdate,
  ): Promise<ICrudResult<IInventario>> {
    try {
      if (!id?.trim()) {
        return { sucesso: false, erro: 'ID do inventário é obrigatório.' };
      }

      const existente = await this.repo.buscarPorId(id);
      if (!existente) {
        return { sucesso: false, erro: 'Inventário não encontrado.' };
      }

      // Transições de status válidas
      const transicoesValidas: Partial<Record<InventarioStatus, InventarioStatus[]>> = {
        AGENDADO:     ['EM_ANDAMENTO', 'CANCELADO'],
        EM_ANDAMENTO: ['CONCLUIDO', 'CANCELADO'],
        CONCLUIDO:    [],
        CANCELADO:    ['AGENDADO'],  // permite reabrir um inventário cancelado
      };

      const permitidos = transicoesValidas[existente.status] ?? [];
      if (!permitidos.includes(input.status)) {
        return {
          sucesso: false,
          erro: `Transição de status inválida: "${existente.status}" → "${input.status}". Permitido: ${permitidos.join(', ') || 'nenhum'}.`,
        };
      }

      const dados = await this.repo.actualizarStatus(id, input);
      return {
        sucesso: true,
        dados: { ...dados, tipo_agendamento: calcularTipoAgendamento(dados.data) },
      };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao actualizar status do inventário.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // CANCELAR — Soft Delete (status = 'CANCELADO')
  // Nunca usa DELETE SQL
  // -------------------------------------------------------------------------
  async cancelar(id: string, motivo?: string): Promise<ICrudResult> {
    try {
      if (!id?.trim()) {
        return { sucesso: false, erro: 'ID do inventário é obrigatório.' };
      }

      const existente = await this.repo.buscarPorId(id);
      if (!existente) {
        return { sucesso: false, erro: 'Inventário não encontrado.' };
      }
      if (existente.status === 'CANCELADO') {
        return { sucesso: false, erro: 'Este inventário já está cancelado.' };
      }
      if (existente.status === 'CONCLUIDO') {
        return {
          sucesso: false,
          erro: 'Não é possível cancelar um inventário já concluído.',
        };
      }

      await this.repo.cancelar(id, motivo);
      return { sucesso: true };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao cancelar inventário.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // UTILITÁRIO PÚBLICO — exposição do cálculo para a UI
  // -------------------------------------------------------------------------
  calcularTipoAgendamento(dataIso: string): TipoAgendamento {
    return calcularTipoAgendamento(dataIso);
  }
}
