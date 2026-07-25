/**
 * Regista handlers da fila local → Supabase field_events.
 * Chamar uma vez no boot da app (App.tsx / RootNavigator).
 */

import { isSupabaseConfigured, supabase } from "./supabase";
import {
  FIELD_EVENT_KINDS,
  upsertFieldEventFromQueueItem,
} from "./fieldEventSync";
import { registerSyncHandler, type SyncQueueItem } from "./sync";

let registered = false;

async function handleFieldEvent(item: SyncQueueItem): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase não configurado — item permanece na fila local.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    throw new Error("Sessão inválida — faça login para sincronizar.");
  }

  await upsertFieldEventFromQueueItem(supabase, item, session.user.id);
}

/**
 * Idempotente: pode ser chamado múltiplas vezes.
 */
export function registerDefaultSyncHandlers(): void {
  if (registered) return;
  registered = true;

  for (const kind of FIELD_EVENT_KINDS) {
    registerSyncHandler(kind, handleFieldEvent);
  }
}

/** Apenas para testes. */
export function _resetSyncHandlersForTests(): void {
  registered = false;
}
