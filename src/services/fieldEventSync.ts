/**
 * Persistência de relatórios A–G e presença na tabela field_events.
 * Usado pelos handlers da fila local (sync.ts).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncQueueItem } from "./sync";

export type FieldEventKind =
  | "reportA"
  | "reportB"
  | "reportC"
  | "reportD"
  | "reportE"
  | "reportF"
  | "reportG"
  | "reportH"
  | "reportI"
  | "reportJ"
  | "attendance";

/**
 * Fonte de verdade dos tipos aceitos na fila de sincronização.
 *
 * O banco replica esta lista no CHECK `chk_field_events_kind`. Ao acrescentar
 * uma tela de relatório nova, estender os dois — senão o upsert falha com
 * violação de constraint, e o relatório some sem erro visível para o usuário.
 * Ver `supabase/migration_attendance_stats_field_events.sql`.
 */
export const FIELD_EVENT_KINDS: FieldEventKind[] = [
  "reportA",
  "reportB",
  "reportC",
  "reportD",
  "reportE",
  "reportF",
  "reportG",
  "reportH",
  "reportI",
  "reportJ",
  "attendance",
];

/** Extrai loja de payload de relatório ou presença. */
export function extractLojaFromPayload(
  kind: string,
  payload: Record<string, unknown>,
): string | null {
  const body =
    (payload.report as Record<string, unknown> | undefined) ||
    (payload.attendance as Record<string, unknown> | undefined) ||
    payload;

  const lojaNum =
    typeof body.lojaNum === "string" ? body.lojaNum.trim() : "";
  const lojaNome =
    typeof body.lojaNome === "string" ? body.lojaNome.trim() : "";
  if (lojaNum && lojaNome) return `${lojaNum} ${lojaNome}`;
  if (lojaNome) return lojaNome;
  if (lojaNum) return lojaNum;

  for (const k of ["loja", "cliente", "filial", "nomeLoja"] as const) {
    const v = body[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Normaliza datas BR (DD/MM/YYYY) ou ISO para YYYY-MM-DD.
 * Retorna null se não reconhecida.
 */
export function extractEventDateFromPayload(
  kind: string,
  payload: Record<string, unknown>,
): string | null {
  const body =
    (payload.report as Record<string, unknown> | undefined) ||
    (payload.attendance as Record<string, unknown> | undefined) ||
    payload;

  const candidates = [body.data, body.dataInventario, body.eventDate];
  for (const raw of candidates) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const s = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  }

  // ReportA/B frequentemente sem data explícita — usa createdAt da fila se vier
  if (typeof payload._queuedAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(payload._queuedAt)) {
    return String(payload._queuedAt).slice(0, 10);
  }
  return null;
}

export function unwrapEventBody(
  kind: string,
  payload: unknown,
): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as Record<string, unknown>;
  if (kind === "attendance" && p.attendance && typeof p.attendance === "object") {
    return p.attendance as Record<string, unknown>;
  }
  if (p.report && typeof p.report === "object") {
    return p.report as Record<string, unknown>;
  }
  return p;
}

/**
 * Upsert idempotente por (user_id, kind, client_event_id).
 * client_event_id = id do item na fila local.
 */
export async function upsertFieldEventFromQueueItem(
  db: SupabaseClient,
  item: SyncQueueItem,
  userId: string,
): Promise<void> {
  if (!FIELD_EVENT_KINDS.includes(item.type as FieldEventKind)) {
    throw new Error(`Tipo de sync não suportado: ${item.type}`);
  }

  const kind = item.type as FieldEventKind;
  const rawPayload =
    item.payload && typeof item.payload === "object"
      ? (item.payload as Record<string, unknown>)
      : {};

  // Anexa timestamp da fila para fallback de data
  const withMeta = { ...rawPayload, _queuedAt: item.createdAt };
  const body = unwrapEventBody(kind, withMeta);
  const loja = extractLojaFromPayload(kind, withMeta);
  const eventDate = extractEventDateFromPayload(kind, withMeta);

  const row = {
    user_id: userId,
    kind,
    client_event_id: item.id,
    event_date: eventDate,
    loja,
    payload: body,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db.from("field_events").upsert(row, {
    onConflict: "user_id,kind,client_event_id",
  });

  if (error) {
    throw new Error(`field_events upsert (${kind}): ${error.message}`);
  }
}
