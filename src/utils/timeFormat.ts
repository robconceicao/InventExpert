/**
 * Padrão de horário do InventExpert: 19h00 (não 19:00).
 */

/** Hora atual no padrão 19h00 */
export function formatTimeNowH(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}h${m}`;
}

/**
 * Formata digitação (só dígitos) para 19h00.
 * Aceita também colagem com ":" ou "h".
 */
export function formatTimeInputH(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 4);
  if (digits.length > 2) return `${digits.slice(0, 2)}h${digits.slice(2)}`;
  return digits;
}

/** Normaliza qualquer variação (19:00, 19h00, 19.00) para 19h00. */
export function normalizeTimeToH(val: string): string {
  if (!val) return "";
  const digits = String(val).replace(/\D/g, "").slice(0, 4);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}h${digits.slice(2).padEnd(2, "0").slice(0, 2)}`;
}

/** Converte "19h00" | "19:00" → minutos do dia (para ordenação/comparação). */
export function timeToMinutesH(t: string): number {
  if (!t) return Infinity;
  const digits = String(t).replace(/\D/g, "");
  if (digits.length < 3) {
    const h = parseInt(digits || "0", 10);
    return (Number.isFinite(h) ? h : 0) * 60;
  }
  const h = parseInt(digits.slice(0, digits.length - 2), 10) || 0;
  const m = parseInt(digits.slice(-2), 10) || 0;
  const mins = h * 60 + m;
  // Horários 0–17h tratados como pós-meia-noite (inventário noturno)
  return h < 18 ? mins + 1440 : mins;
}
