/**
 * InventExpert — Módulo Clientes
 * index.ts — API pública do módulo
 */
export { ClientesRepository } from './repository';
export { ClientesService }    from './service';
export { useClientes }        from './controller';
export type {
  ICrudResult,
  ICliente,
  IClienteFilter,
  IClienteInput,
  IClienteUpdate,
} from './types';
