/**
 * InventExpert — Módulo Clientes
 * service.ts — Lógica de negócio e validações
 *
 * Responsabilidades:
 *  1. Validar dados antes de persistir
 *  2. Garantir unicidade do codigo_loja
 *  3. Encapsular erros em mensagens amigáveis em PT-BR
 *  4. Jamais expor erros brutos do banco ao chamador
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { ClientesRepository } from './repository';
import type {
  ICliente,
  IClienteFilter,
  IClienteInput,
  IClienteUpdate,
  ICrudResult,
} from './types';

// ---------------------------------------------------------------------------
// Constantes de validação
// ---------------------------------------------------------------------------
const UF_VALIDAS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

// ---------------------------------------------------------------------------
// Funções auxiliares de validação (puras, sem side-effects)
// ---------------------------------------------------------------------------

function validarUF(estado: string): boolean {
  return UF_VALIDAS.includes(estado.toUpperCase());
}

function validarNome(nome: string): string | null {
  const n = nome.trim();
  if (!n) return 'O nome da loja é obrigatório.';
  if (n.length < 2) return 'O nome da loja deve ter pelo menos 2 caracteres.';
  if (n.length > 200) return 'O nome da loja não pode exceder 200 caracteres.';
  return null;
}

function validarCidade(cidade: string): string | null {
  if (!cidade?.trim()) return 'A cidade é obrigatória.';
  return null;
}

// ===========================================================================
// SERVICE
// ===========================================================================
export class ClientesService {
  private readonly repo: ClientesRepository;

  constructor(db: SupabaseClient) {
    this.repo = new ClientesRepository(db);
  }

  // -------------------------------------------------------------------------
  // LISTAR
  // -------------------------------------------------------------------------
  async listar(
    filtros: IClienteFilter = {},
    apenasAtivos = true,
  ): Promise<ICrudResult<ICliente[]>> {
    try {
      const dados = await this.repo.listar(filtros, apenasAtivos);
      return { sucesso: true, dados };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error
          ? e.message
          : 'Erro inesperado ao listar clientes.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // BUSCAR POR ID
  // -------------------------------------------------------------------------
  async buscarPorId(id: string): Promise<ICrudResult<ICliente>> {
    try {
      if (!id?.trim()) {
        return { sucesso: false, erro: 'ID do cliente é obrigatório.' };
      }
      const dados = await this.repo.buscarPorId(id);
      if (!dados) {
        return { sucesso: false, erro: 'Cliente não encontrado.' };
      }
      return { sucesso: true, dados };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao buscar cliente.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // CADASTRAR
  // -------------------------------------------------------------------------
  async cadastrar(input: IClienteInput): Promise<ICrudResult<ICliente>> {
    try {
      // --- Validações obrigatórias ---
      const erroNome = validarNome(input.nome ?? '');
      if (erroNome) return { sucesso: false, erro: erroNome };

      const erroCidade = validarCidade(input.cidade ?? '');
      if (erroCidade) return { sucesso: false, erro: erroCidade };

      if (!input.estado?.trim()) {
        return { sucesso: false, erro: 'O estado (UF) é obrigatório.' };
      }
      if (!validarUF(input.estado)) {
        return { sucesso: false, erro: `Estado inválido: "${input.estado}". Use a sigla de 2 letras (ex: SP, RJ).` };
      }

      // --- Unicidade do codigo_loja ---
      if (input.codigo_loja) {
        const codigoStr = String(input.codigo_loja).trim();
        const jaExiste = await this.repo.existeCodigo(codigoStr);
        if (jaExiste) {
          return {
            sucesso: false,
            erro: `Já existe um cliente com o código de loja "${codigoStr}".`,
          };
        }
      }

      const dados = await this.repo.inserir({
        ...input,
        nome: input.nome.trim(),
        cidade: input.cidade.trim(),
        estado: input.estado.toUpperCase(),
      });

      return { sucesso: true, dados };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro inesperado ao cadastrar cliente.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // CREATE LOTE
  // -------------------------------------------------------------------------
  async inserirLote(inputs: IClienteInput[]): Promise<ICrudResult<number>> {
    try {
      if (!inputs || inputs.length === 0) {
        return { sucesso: false, erro: 'Nenhum dado para importar.' };
      }

      const validos: IClienteInput[] = [];
      for (const input of inputs) {
        if (!input.nome?.trim() || !input.cidade?.trim() || !validarUF(input.estado ?? '')) {
          continue; // Pular inválidos silenciosamente
        }
        validos.push(input);
      }

      if (validos.length === 0) {
        return { sucesso: false, erro: 'Nenhum registro válido encontrado na planilha.' };
      }

      const dados = await this.repo.inserirLote(validos);
      return { sucesso: true, dados: dados.length };
    } catch (e) {
      return { sucesso: false, erro: e instanceof Error ? e.message : 'Erro na importação em lote.' };
    }
  }

  // -------------------------------------------------------------------------
  // ACTUALIZAR
  // -------------------------------------------------------------------------
  async actualizar(id: string, input: IClienteUpdate): Promise<ICrudResult<ICliente>> {
    try {
      if (!id?.trim()) {
        return { sucesso: false, erro: 'ID do cliente é obrigatório.' };
      }

      // Verifica se o cliente existe
      const existente = await this.repo.buscarPorId(id);
      if (!existente) {
        return { sucesso: false, erro: 'Cliente não encontrado para actualização.' };
      }

      // Validações condicionais
      if (input.nome !== undefined) {
        const erroNome = validarNome(input.nome);
        if (erroNome) return { sucesso: false, erro: erroNome };
      }
      if (input.cidade !== undefined) {
        const erroCidade = validarCidade(input.cidade);
        if (erroCidade) return { sucesso: false, erro: erroCidade };
      }
      if (input.estado !== undefined && !validarUF(input.estado)) {
        return { sucesso: false, erro: `Estado inválido: "${input.estado}".` };
      }
      if (input.codigo_loja !== undefined) {
        const codigoStr = String(input.codigo_loja).trim();
        const jaExiste = await this.repo.existeCodigo(codigoStr, id);
        if (jaExiste) {
          return {
            sucesso: false,
            erro: `O código de loja "${codigoStr}" já está em uso por outro cliente.`,
          };
        }
      }

      const dados = await this.repo.actualizar(id, {
        ...input,
        ...(input.nome     ? { nome:   input.nome.trim()     } : {}),
        ...(input.cidade   ? { cidade: input.cidade.trim()   } : {}),
        ...(input.estado   ? { estado: input.estado.toUpperCase() } : {}),
      });

      return { sucesso: true, dados };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro inesperado ao actualizar cliente.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // DESACTIVAR (Soft Delete)
  // -------------------------------------------------------------------------
  async desativar(id: string): Promise<ICrudResult> {
    try {
      if (!id?.trim()) {
        return { sucesso: false, erro: 'ID do cliente é obrigatório.' };
      }

      const existente = await this.repo.buscarPorId(id);
      if (!existente) {
        return { sucesso: false, erro: 'Cliente não encontrado.' };
      }
      if (!existente.ativo) {
        return { sucesso: false, erro: 'Este cliente já está inactivo.' };
      }

      await this.repo.desativar(id);
      return { sucesso: true };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao desactivar cliente.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // REACTIVAR
  // -------------------------------------------------------------------------
  async reativar(id: string): Promise<ICrudResult> {
    try {
      if (!id?.trim()) {
        return { sucesso: false, erro: 'ID do cliente é obrigatório.' };
      }
      await this.repo.reativar(id);
      return { sucesso: true };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao reactivar cliente.',
      };
    }
  }
}
