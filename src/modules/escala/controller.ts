/**
 * InventExpert — Escala Module
 * controller.ts — Camada de controlo: adapta o Service para a UI React Native
 *
 * Expõe hooks React e funções de alto nível que gerem estado,
 * loading e erros para os ecrãs que consomem este módulo.
 *
 * Padrão: Controller não contém lógica de negócio — apenas adapta.
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import type {
  GerarEscalaResult,
  Inventario,
  InventarioInput,
  ListarEscalaRow,
} from '../../types';
import { EscalaInsuficienteError } from '../../types';
import { agruparEscalaPorPapel } from './model';
import type { EscalaService } from './service';

// ===========================================================================
// Hook: useEscalaService
// Instancia e memoriza o EscalaService. Importa dinamicamente para evitar
// inicialização quando Supabase não está configurado.
// ===========================================================================

// ---------------------------------------------------------------------------
// Hook: useInventarios
// ---------------------------------------------------------------------------
export function useInventarios(service: EscalaService, statusFiltro?: string) {
  const [inventarios, setInventarios] = useState<Inventario[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lista = await service.listarInventarios(statusFiltro);
      setInventarios(lista);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar inventários';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [service, statusFiltro]);

  useEffect(() => { void carregar(); }, [carregar]);

  return { inventarios, loading, error, recarregar: carregar };
}

// ---------------------------------------------------------------------------
// Hook: useEscala
// Carrega e gera escala para um inventário específico.
// ---------------------------------------------------------------------------
export function useEscala(service: EscalaService, inventarioId: string | null) {
  const [escala, setEscala]       = useState<ListarEscalaRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [gerando, setGerando]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [resultado, setResultado] = useState<GerarEscalaResult | null>(null);

  const carregarEscala = useCallback(async () => {
    if (!inventarioId) return;
    setLoading(true);
    setError(null);
    try {
      const { itens } = await service.listarEscala(inventarioId);
      setEscala(itens);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar escala');
    } finally {
      setLoading(false);
    }
  }, [service, inventarioId]);

  useEffect(() => { void carregarEscala(); }, [carregarEscala]);

  const gerarEscala = useCallback(async () => {
    if (!inventarioId) return;
    setGerando(true);
    setError(null);
    try {
      const res = await service.processarGeracao(inventarioId);
      setResultado(res);
      await carregarEscala();

      if (res.avisos && res.avisos.length > 0) {
        Alert.alert('Escala gerada com avisos', res.avisos.join('\n'));
      }
    } catch (e) {
      if (e instanceof EscalaInsuficienteError) {
        Alert.alert('Headcount Insuficiente', e.message);
      } else {
        const msg = e instanceof Error ? e.message : 'Erro ao gerar escala';
        setError(msg);
        Alert.alert('Erro ao gerar escala', msg);
      }
    } finally {
      setGerando(false);
    }
  }, [service, inventarioId, carregarEscala]);

  const confirmarColaborador = useCallback(
    async (escalaId: string, confirmado = true) => {
      try {
        await service.confirmarColaborador(escalaId, confirmado);
        await carregarEscala();
      } catch (e) {
        Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao confirmar');
      }
    },
    [service, carregarEscala],
  );

  const agrupado = agruparEscalaPorPapel(escala);

  return {
    escala,
    agrupado,
    loading,
    gerando,
    error,
    resultado,
    gerarEscala,
    confirmarColaborador,
    recarregar: carregarEscala,
  };
}

// ---------------------------------------------------------------------------
// Hook: usePreviewComposicao
// Mostra quantos colaboradores estão disponíveis antes de gerar a escala.
// ---------------------------------------------------------------------------
export function usePreviewComposicao(
  service: EscalaService,
  inventarioId: string | null,
) {
  const [preview, setPreview] = useState<Awaited<
    ReturnType<EscalaService['previewComposicao']>
  > | null>(null);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    if (!inventarioId) return;
    setLoading(true);
    try {
      const p = await service.previewComposicao(inventarioId);
      setPreview(p);
    } catch {
      // Silencia aqui — erro será tratado na geração real
    } finally {
      setLoading(false);
    }
  }, [service, inventarioId]);

  useEffect(() => { void carregar(); }, [carregar]);

  return { preview, loading, recarregar: carregar };
}

// ---------------------------------------------------------------------------
// Hook: useRankingColaboradores
// ---------------------------------------------------------------------------
export function useRankingColaboradores(
  service: EscalaService,
  cidadeCliente?: string,
) {
  const [ranking, setRanking] = useState<
    Awaited<ReturnType<EscalaService['rankingColaboradores']>>
  >([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const lista = await service.rankingColaboradores(cidadeCliente);
      setRanking(lista);
    } catch {
      // silencia
    } finally {
      setLoading(false);
    }
  }, [service, cidadeCliente]);

  useEffect(() => { void carregar(); }, [carregar]);

  return { ranking, loading, recarregar: carregar };
}

// ---------------------------------------------------------------------------
// Ação: criarInventario
// Wrapper imperativo para criação de inventário (formulários).
// ---------------------------------------------------------------------------
export async function criarInventarioAction(
  service: EscalaService,
  input: InventarioInput,
): Promise<{ sucesso: boolean; inventario?: Inventario; erro?: string }> {
  try {
    const inventario = await service.criarInventario(input);
    return { sucesso: true, inventario };
  } catch (e) {
    return {
      sucesso: false,
      erro: e instanceof Error ? e.message : 'Erro desconhecido',
    };
  }
}
