/** Durable local outbox. Unknown legacy owners are preserved, never reassigned. */
import AsyncStorage from "@react-native-async-storage/async-storage";
const SYNC_QUEUE_KEY = "inventexpert:sync_queue";
export type SyncQueueItem = { id: string; ownerId?: string; type: string; payload: unknown; createdAt: string };
export type SyncFlushResult = { ok: boolean; pending: number; processed: number; message: string };
export type SyncItemHandler = (item: SyncQueueItem) => Promise<void>;
const handlers = new Map<string, SyncItemHandler>();
let resolveOwner: () => Promise<string | null> = async () => null;
let writes: Promise<unknown> = Promise.resolve();
let flushing: Promise<SyncFlushResult> | null = null;
export function configureSyncOwner(resolver: () => Promise<string | null>): void { resolveOwner = resolver; }
export function registerSyncHandler(type: string, handler: SyncItemHandler): void { handlers.set(type, handler); }
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = writes.then(operation);
  writes = result.catch(() => undefined);
  return result;
}
async function readAll(): Promise<SyncQueueItem[]> {
  const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  const items: unknown = JSON.parse(raw ?? "[]");
  if (!Array.isArray(items) || items.some(item => !item || typeof item.id !== "string" || typeof item.type !== "string")) {
    throw new Error("Fila local inválida. Os dados foram preservados para recuperação.");
  }
  return items;
}
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const owner = await resolveOwner();
  return owner ? serialized(async () => (await readAll()).filter(item => item.ownerId === owner)) : [];
}
export async function getSyncQueueLength(): Promise<number> { return (await getSyncQueue()).length; }
export async function enqueueSyncItem(type: string, payload: unknown): Promise<void> {
  const ownerId = await resolveOwner();
  if (!ownerId) throw new Error("Entre na sua conta para preparar a sincronização. O formulário foi mantido.");
  const item: SyncQueueItem = JSON.parse(JSON.stringify({
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 12), ownerId, type, payload,
    createdAt: new Date().toISOString(),
  }));
  await serialized(async () => {
    const items = await readAll();
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([...items, item]));
  });
}
async function flush(): Promise<SyncFlushResult> {
  let processed = 0;
  try {
    const owner = await resolveOwner();
    if (!owner) return { ok: false, pending: 0, processed, message: "Faça login para sincronizar seus registros." };
    const items = await serialized(async () => (await readAll()).filter(item => item.ownerId === owner));
    for (const item of items) {
      if (await resolveOwner() !== owner) break;
      const handler = handlers.get(item.type);
      if (!handler) continue;
      try { await handler(item); } catch { continue; }
      // Reload under lock. Never replace the queue with an earlier snapshot.
      await serialized(async () => {
        const current = await readAll();
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(current.filter(row => !(row.id === item.id && row.ownerId === owner))));
      });
      processed++;
    }
    const pending = await serialized(async () => (await readAll()).filter(item => item.ownerId === owner).length);
    return { ok: pending === 0, pending, processed, message: "Sincronizados " + processed + "; " + pending + " pendente(s) desta conta." };
  } catch (error) {
    return { ok: false, pending: -1, processed, message: error instanceof Error ? error.message : "Falha ao acessar a fila local." };
  }
}
export function syncQueue(): Promise<SyncFlushResult> {
  if (!flushing) flushing = flush().finally(() => { flushing = null; });
  return flushing;
}
/** Clears only the current account's outbox. Legacy/other owners remain intact. */
export async function clearSyncQueue(): Promise<void> {
  const owner = await resolveOwner();
  if (!owner) throw new Error("Sessão necessária.");
  await serialized(async () => {
    const items = await readAll();
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(items.filter(item => item.ownerId !== owner)));
  });
}
