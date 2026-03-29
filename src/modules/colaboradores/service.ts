/**
 * InventExpert — Módulo Colaboradores
 * service.ts — Lógica de negócio e validações
 *
 * Regras de negócio específicas (conforme especificação):
 *  1. cidade, funcao e telefone são OBRIGATÓRIOS ao cadastrar
 *  2. ativo = true é definido automaticamente (nunca pelo chamador)
 *  3. matricula é única quando fornecida
 *  4. Soft delete: desativação via ativo = false
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { ColaboradoresRepository } from './repository';
import type {
  ColaboradorFuncao,
  ICrudResult,
  IColaborador,
  IColaboradorFilter,
  IColaboradorInput,
  IColaboradorUpdate,
} from './types';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const FUNCOES_VALIDAS: ColaboradorFuncao[] = ['LIDER', 'CONFERENTE'];

const UF_VALIDAS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

// Regex simples para validação de telefone brasileiro (com ou sem DDI)
const REGEX_TELEFONE = /^(\+55\s?)?(\(?\d{2}\)?\s?)(\d{4,5}[\s-]?\d{4})$/;

// ---------------------------------------------------------------------------
// Funções de validação
// ---------------------------------------------------------------------------

function validarFuncao(funcao: unknown): string | null {
  if (!funcao || !FUNCOES_VALIDAS.includes(funcao as ColaboradorFuncao)) {
    return `Função inválida. Use: ${FUNCOES_VALIDAS.join(' ou ')}.`;
  }
  return null;
}

function validarTelefone(telefone: string | undefined): string | null {
  if (!telefone?.trim()) {
    return 'O telefone é obrigatório para cadastro de colaborador.';
  }
  const limpo = telefone.replace(/\s/g, '');
  if (!REGEX_TELEFONE.test(limpo)) {
    return 'Telefone inválido. Use o formato: (11) 99999-9999';
  }
  return null;
}

function validarUF(estado: string | undefined): string | null {
  if (!estado?.trim()) return 'O estado (UF) é obrigatório.';
  if (!UF_VALIDAS.includes(estado.toUpperCase())) {
    return `Estado inválido: "${estado}". Use a sigla de 2 letras (ex: SP, RJ).`;
  }
  return null;
}

// ===========================================================================
// SERVICE
// ===========================================================================
export class ColaboradoresService {
  private readonly repo: ColaboradoresRepository;

  constructor(db: SupabaseClient) {
    this.repo = new ColaboradoresRepository(db);
  }

  // -------------------------------------------------------------------------
  // LISTAR
  // -------------------------------------------------------------------------
  async listar(
    filtros: IColaboradorFilter = {},
    apenasAtivos = true,
  ): Promise<ICrudResult<IColaborador[]>> {
    try {
      const dados = await this.repo.listar(filtros, apenasAtivos);
      return { sucesso: true, dados };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao listar colaboradores.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // BUSCAR POR ID
  // -------------------------------------------------------------------------
  async buscarPorId(id: string): Promise<ICrudResult<IColaborador>> {
    try {
      if (!id?.trim()) {
        return { sucesso: false, erro: 'ID do colaborador é obrigatório.' };
      }
      const dados = await this.repo.buscarPorId(id);
      if (!dados) {
        return { sucesso: false, erro: 'Colaborador não encontrado.' };
      }
      return { sucesso: true, dados };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao buscar colaborador.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // CADASTRAR
  // Regra: cidade, funcao e telefone são OBRIGATÓRIOS
  // -------------------------------------------------------------------------
  async cadastrar(input: IColaboradorInput): Promise<ICrudResult<IColaborador>> {
    try {
      // Validações obrigatórias
      if (!input.nome?.trim()) {
        return { sucesso: false, erro: 'O nome do colaborador é obrigatório.' };
      }
      if (input.nome.trim().length < 3) {
        return { sucesso: false, erro: 'O nome deve ter pelo menos 3 caracteres.' };
      }

      const erroFuncao = validarFuncao(input.funcao);
      if (erroFuncao) return { sucesso: false, erro: erroFuncao };

      if (!input.cidade?.trim()) {
        return { sucesso: false, erro: 'A cidade é obrigatória.' };
      }

      const erroUF = validarUF(input.estado);
      if (erroUF) return { sucesso: false, erro: erroUF };

      // Telefone OBRIGATÓRIO conforme regra de negócio
      const erroTelefone = validarTelefone(input.telefone);
      if (erroTelefone) return { sucesso: false, erro: erroTelefone };

      // Unicidade da matrícula
      if (input.matricula?.trim()) {
        const jaExiste = await this.repo.existeMatricula(input.matricula.trim());
        if (jaExiste) {
          return {
            sucesso: false,
            erro: `Já existe um colaborador com a matrícula "${input.matricula}".`,
          };
        }
      }

      const dados = await this.repo.inserir({
        ...input,
        nome:    input.nome.trim(),
        cidade:  input.cidade.trim(),
        estado:  input.estado.toUpperCase(),
        matricula: input.matricula?.trim() || undefined,
        // ativo é sempre true — não aceita do input
        ativo: true,
      });

      return { sucesso: true, dados };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro inesperado ao cadastrar colaborador.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // ACTUALIZAR
  // -------------------------------------------------------------------------
  async actualizar(
    id: string,
    input: IColaboradorUpdate,
  ): Promise<ICrudResult<IColaborador>> {
    try {
      if (!id?.trim()) {
        return { sucesso: false, erro: 'ID do colaborador é obrigatório.' };
      }

      const existente = await this.repo.buscarPorId(id);
      if (!existente) {
        return { sucesso: false, erro: 'Colaborador não encontrado.' };
      }
      if (!existente.ativo) {
        return {
          sucesso: false,
          erro: 'Não é possível editar um colaborador inactivo. Reactive-o primeiro.',
        };
      }

      if (input.funcao !== undefined) {
        const erroFuncao = validarFuncao(input.funcao);
        if (erroFuncao) return { sucesso: false, erro: erroFuncao };
      }
      if (input.estado !== undefined) {
        const erroUF = validarUF(input.estado);
        if (erroUF) return { sucesso: false, erro: erroUF };
      }
      if (input.telefone !== undefined) {
        const erroTel = validarTelefone(input.telefone);
        if (erroTel) return { sucesso: false, erro: erroTel };
      }
      if (input.matricula !== undefined && input.matricula.trim()) {
        const jaExiste = await this.repo.existeMatricula(input.matricula.trim(), id);
        if (jaExiste) {
          return {
            sucesso: false,
            erro: `A matrícula "${input.matricula}" já está em uso por outro colaborador.`,
          };
        }
      }

      const dados = await this.repo.actualizar(id, input);
      return { sucesso: true, dados };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro inesperado ao actualizar colaborador.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // DESACTIVAR — Soft Delete (ativo = false)
  // NUNCA remove o colaborador: histórico de produtividade deve ser preservado
  // -------------------------------------------------------------------------
  async desativar(id: string): Promise<ICrudResult> {
    try {
      if (!id?.trim()) {
        return { sucesso: false, erro: 'ID do colaborador é obrigatório.' };
      }

      const existente = await this.repo.buscarPorId(id);
      if (!existente) {
        return { sucesso: false, erro: 'Colaborador não encontrado.' };
      }
      if (!existente.ativo) {
        return { sucesso: false, erro: 'Este colaborador já está inactivo.' };
      }

      await this.repo.desativar(id);
      return { sucesso: true };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao desactivar colaborador.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // REACTIVAR
  // -------------------------------------------------------------------------
  async reativar(id: string): Promise<ICrudResult> {
    try {
      if (!id?.trim()) {
        return { sucesso: false, erro: 'ID do colaborador é obrigatório.' };
      }
      const existente = await this.repo.buscarPorId(id);
      if (!existente) {
        return { sucesso: false, erro: 'Colaborador não encontrado.' };
      }
      if (existente.ativo) {
        return { sucesso: false, erro: 'Este colaborador já está activo.' };
      }
      await this.repo.reativar(id);
      return { sucesso: true };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao reactivar colaborador.',
      };
    }
  }

  // -------------------------------------------------------------------------
  // LISTAR POR FUNÇÃO (para selects de UI)
  // -------------------------------------------------------------------------
  async listarLideres(): Promise<ICrudResult<IColaborador[]>> {
    try {
      const dados = await this.repo.listarPorFuncao('LIDER');
      return { sucesso: true, dados };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao listar líderes.',
      };
    }
  }

  async listarConferentes(cidade?: string): Promise<ICrudResult<IColaborador[]>> {
    try {
      const dados = await this.repo.listarPorFuncao('CONFERENTE', cidade);
      return { sucesso: true, dados };
    } catch (e) {
      return {
        sucesso: false,
        erro: e instanceof Error ? e.message : 'Erro ao listar conferentes.',
      };
    }
  }
}
