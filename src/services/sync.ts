/**
 * Fila local de rascunhos (AsyncStorage).
 *
 * NÃO é sincronização multi-dispositivo completa.
 * Itens enfileirados ficam no aparelho até o utilizador/processo
 * consumir a fila com um handler registado — ou serem limpos.
 *
 * O ícone de nuvem no header reflecte apenas conectividade (NetInfo).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const SYNC_QUEUE_KEY = "inventexpert:sync_queue";

export type SyncQueueItem = {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
};

export type SyncFlushResult = {
  /** true quando não havia itens ou todos foram processados */
  ok: boolean;
  pending: number;
  processed: number;
  message: string;
};

/** Handler opcional por tipo (ex.: "produtividade" → API). */
export type SyncItemHandler = (item: SyncQueueItem) => Promise<void>;

const handlers = new Map<string, SyncItemHandler>();

export function registerSyncHandler(type: string, handler: SyncItemHandler): void {
  handlers.set(type, handler);
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    const list = JSON.parse(raw || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function getSyncQueueLength(): Promise<number> {
  return (await getSyncQueue()).length;
}

export const enqueueSyncItem = async (type: string, payload: unknown) => {
  try {
    const currentQueue = await getSyncQueue();
    currentQueue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(currentQueue));
  } catch (e) {
    console.error("[SYNC] Erro ao enfileirar:", e);
  }
};

/**
 * Processa a fila com handlers registados.
 * Itens sem handler permanecem na fila (não são descartados em silêncio).
 */
export const syncQueue = async (): Promise<SyncFlushResult> => {
  const queue = await getSyncQueue();
  if (queue.length === 0) {
    return {
      ok: true,
      pending: 0,
      processed: 0,
      message: "Fila local vazia.",
    };
  }

  if (handlers.size === 0) {
    return {
      ok: false,
      pending: queue.length,
      processed: 0,
      message:
        `Há ${queue.length} item(ns) na fila local, mas nenhum handler de sync está registado. ` +
        "Dados permanecem apenas neste dispositivo.",
    };
  }

  const remaining: SyncQueueItem[] = [];
  let processed = 0;

  for (const item of queue) {
    const handler = handlers.get(item.type);
    if (!handler) {
      remaining.push(item);
      continue;
    }
    try {
      await handler(item);
      processed += 1;
    } catch (e) {
      console.error(`[SYNC] Falha no item ${item.id} (${item.type}):`, e);
      remaining.push(item);
    }
  }

  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));

  return {
    ok: remaining.length === 0,
    pending: remaining.length,
    processed,
    message:
      remaining.length === 0
        ? `Sincronizados ${processed} item(ns).`
        : `Processados ${processed}; ${remaining.length} pendente(s).`,
  };
};

/** Limpa a fila local (irreversível). */
export async function clearSyncQueue(): Promise<void> {
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, "[]");
}
