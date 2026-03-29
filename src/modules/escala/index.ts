/**
 * InventExpert — Escala Module
 * index.ts — Barrel export (ponto de entrada público do módulo)
 *
 * Uso na UI:
 *   import { EscalaService, useEscala, useInventarios } from '../modules/escala';
 */

// Camada de Domínio (Model)
export {
  ESCALA_CONFIG,
  INVENTARIO_STATUS_LABEL,
  PAPEL_LABEL,
  agruparEscalaPorPapel,
  calcularComposicaoEscala,
  calcularScoreFinal,
} from './model';

// Camada de Dados (Repositories) — exporta para uso avançado
export {
  ClientesRepository,
  ColaboradoresRepository,
  EscalaRepository,
  InventariosRepository,
  ProdutividadeRepository,
} from './repository';

// Camada de Serviço — principal ponto de entrada para lógica
export { EscalaService } from './service';

// Camada de Controlo — hooks React e ações para UI
export {
  criarInventarioAction,
  useEscala,
  useInventarios,
  usePreviewComposicao,
  useRankingColaboradores,
} from './controller';

// Re-exporta tipos relevantes para conveniência
// Tipos base do domínio (re-exportados pelo model)
export type {
  Cliente,
  Colaborador,
  ColaboradorFuncao,
  EscalaItem,
  EscalaPapel,
  GerarEscalaResult,
  Inventario,
  InventarioStatus,
  ListarEscalaRow,
  ProdutividadeConsolidada,
} from './model';

// Tipos de Input definidos em types/index.ts
export type {
  ClienteInput,
  ColaboradorInput,
  InventarioInput,
  ProdutividadeInput,
} from '../../types';

