/** Regras puras do alarme de avanços (testáveis sem expo-notifications). */

const parsePct = (v: unknown): number => {
  const n = parseFloat(String(v ?? "").replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
};

/** true se algum valor de avanço ≥ 100%. */
export function isAdvanceAt100(...values: unknown[]): boolean {
  return values.some((v) => parsePct(v) >= 100);
}

export function isWarningTime(targetHour: number, targetMin: number, now: Date = new Date()): boolean {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  let targetMins = targetHour * 60 + targetMin;
  if (targetHour < 18 && now.getHours() >= 18) {
    targetMins += 1440;
  }
  const diff = targetMins - nowMins;
  return diff >= 0 && diff <= 15;
}

export function isNearWarningTime(
  targetHour: number,
  targetMin: number,
  now: Date = new Date(),
): boolean {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  let targetMins = targetHour * 60 + targetMin;
  if (targetHour < 18 && now.getHours() >= 18) {
    targetMins += 1440;
  }
  const diff = targetMins - nowMins;
  return diff >= -5 && diff <= 17;
}
