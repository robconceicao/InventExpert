/**
 * InventExpert — Módulo Colaboradores
 * index.ts — API pública do módulo
 */
export { ColaboradoresRepository } from './repository';
export { ColaboradoresService }    from './service';
export { useColaboradores }        from './controller';
export type {
  ColaboradorFuncao,
  ICrudResult,
  IColaborador,
  IColaboradorFilter,
  IColaboradorInput,
  IColaboradorUpdate,
} from './types';
