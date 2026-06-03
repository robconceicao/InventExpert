/** Converte duração informada pelo líder (horas decimais ou H:MM). */
export function parseDuracaoInput(s: string): number {
  const t = s.trim();
  if (!t) return 5;
  if (t.includes(":")) {
    const parts = t.split(":");
    const h = parseInt(parts[0]?.replace(/\D/g, "") ?? "0", 10) || 0;
    const m = parseInt(parts[1]?.replace(/\D/g, "") ?? "0", 10) || 0;
    const total = h + m / 60;
    return total > 0 ? total : 5;
  }
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 5;
}
