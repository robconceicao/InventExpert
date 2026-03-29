/**
 * InventExpert — Módulo Colaboradores
 * controller.ts — Adapta a Service para a UI React Native
 */
import { useCallback, useEffect, useState } from 'react';

import type { ColaboradoresService } from './service';
import type { IColaborador, IColaboradorFilter, IColaboradorInput, IColaboradorUpdate } from './types';

export function useColaboradores(
  service: ColaboradoresService,
  filtrosRef?: IColaboradorFilter,
  apenasAtivos = true,
) {
  const [colaboradores, setColaboradores] = useState<IColaborador[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await service.listar(filtrosRef ?? {}, apenasAtivos);
      if (!result.sucesso) {
        setError(result.erro ?? 'Erro desconhecido ao carregar colaboradores');
      } else {
        setColaboradores(result.dados ?? []);
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

  const criar = async (input: IColaboradorInput) => {
    const result = await service.cadastrar(input);
    if (!result.sucesso) throw new Error(result.erro);
    await carregar();
    return result.dados!;
  };

  const atualizar = async (id: string, input: IColaboradorUpdate) => {
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
    colaboradores,
    loading,
    error,
    recarregar: carregar,
    criar,
    atualizar,
    desativar,
  };
}
