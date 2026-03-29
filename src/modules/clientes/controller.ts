/**
 * InventExpert — Módulo Clientes
 * controller.ts — Adapta a Service (ClientesService) para a UI React Native
 */
import { useCallback, useEffect, useState } from 'react';

import type { ClientesService } from './service';
import type { ICliente, IClienteFilter, IClienteInput, IClienteUpdate } from './types';

export function useClientes(
  service: ClientesService,
  filtrosRef?: IClienteFilter,
  apenasAtivos = true,
) {
  const [clientes, setClientes] = useState<ICliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await service.listar(filtrosRef ?? {}, apenasAtivos);
      if (!result.sucesso) {
        setError(result.erro ?? 'Erro desconhecido ao carregar clientes');
      } else {
        setClientes(result.dados ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na comunicação');
    } finally {
      setLoading(false);
    }
  }, [service, filtrosRef, apenasAtivos]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const criar = async (input: IClienteInput) => {
    const result = await service.cadastrar(input);
    if (!result.sucesso) throw new Error(result.erro);
    await carregar();
    return result.dados!;
  };

  const atualizar = async (id: string, input: IClienteUpdate) => {
    const result = await service.actualizar(id, input);
    if (!result.sucesso) throw new Error(result.erro);
    await carregar();
    return result.dados!;
  };

  const desativar = async (id: string) => {
    const result = await service.desativar(id);
    if (!result.sucesso) throw new Error(result.erro);
    await carregar();
  };

  return {
    clientes,
    loading,
    error,
    recarregar: carregar,
    criar,
    atualizar,
    desativar,
  };
}
