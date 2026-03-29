/**
 * InventExpert — Módulo Colaboradores
 * index.ts — API pública do módulo
 */
export { ColaboradoresRepository } from './repository';
export { ColaboradoresService }    from './service';
export type {
  ColaboradorFuncao,
  ICrudResult,
  IColaborador,
  IColaboradorFilter,
  IColaboradorInput,
  IColaboradorUpdate,
} from './types';
