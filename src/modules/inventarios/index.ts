/**
 * InventExpert — Módulo Inventários
 * index.ts — API pública do módulo
 */
export { InventariosRepository }  from './repository';
export { InventariosService }     from './service';
export { useInventariosCrud }     from './controller';
export type {
  ICrudResult,
  IInventario,
  IInventarioFilter,
  IInventarioInput,
  IInventarioStatusUpdate,
  IInventarioUpdate,
  InventarioStatus,
  InventoryOperationType,
  TipoAgendamento,
} from './types';
