/**
 * InventExpert — Módulo Inventários
 * controller.ts — Adapta a Service para a UI React Native
 */
import { useCallback, useEffect, useState } from 'react';

import type { InventariosService } from './service';
import type { IInventario, IInventarioFilter, IInventarioInput, IInventarioStatusUpdate, IInventarioUpdate } from './types';

export function useInventariosCrud(
  service: InventariosService,
  filtrosRef?: IInventarioFilter,
  incluirCancelados = false,
) {
  const [inventarios, setInventarios] = useState<IInventario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await service.listar(filtrosRef ?? {}, incluirCancelados);
      if (!result.sucesso) {
        setError(result.erro ?? 'Erro desconhecido ao carregar inventários');
      } else {
        setInventarios(result.dados ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na comunicação');
    } finally {
      setLoading(false);
    }
  }, [service, filtrosRef, incluirCancelados]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const criar = async (input: IInventarioInput) => {
    const result = await service.cadastrar(input);
    if (!result.sucesso) throw new Error(result.erro);
    await carregar();
    return result.dados!;
  };

  const atualizar = async (id: string, input: IInventarioUpdate) => {
    const result = await service.actualizar(id, input);
    if (!result.sucesso) throw new Error(result.erro);
    await carregar();
    return result.dados!;
  };

  const atualizarStatus = async (id: string, input: IInventarioStatusUpdate) => {
    const result = await service.atualizarStatus(id, input);
    if (!result.sucesso) throw new Error(result.erro);
    await carregar();
    return result.dados!;
  };

  const cancelar = async (id: string, motivo?: string) => {
    const result = await service.cancelar(id, motivo);
    if (!result.sucesso) throw new Error(result.erro);
    await carregar();
  };

  const inserirLoteExcel = async (linhas: any[]) => {
    const result = await service.inserirLoteExcel(linhas);
    if (!result.sucesso) throw new Error(result.erro);
    await carregar();
    return result.dados!;
  };

  return {
    inventarios,
    loading,
    error,
    recarregar: carregar,
    criar,
    atualizar,
    atualizarStatus,
    cancelar,
    inserirLoteExcel,
  };
}
