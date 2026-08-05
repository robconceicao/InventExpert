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

// ---------------------------------------------------------------------------
// Liberação do aviso por preenchimento do avanço anterior
// ---------------------------------------------------------------------------

export type CampoAvanco =
  | "avanco22h"
  | "avanco00h"
  | "avanco01h"
  | "avanco03h"
  | "avanco04h";

/** Só os campos de avanço interessam à regra — aceita o ReportA inteiro. */
export type ReportComAvancos = Partial<Record<CampoAvanco, unknown>>;

export interface AvancoMonitorado {
  label: string;
  hour: number;
  minute: number;
  /** Campo preenchido no próprio avanço. */
  campo: CampoAvanco;
  /** Campo do avanço anterior — precisa estar preenchido para liberar o aviso. */
  campoAnterior: CampoAvanco;
}

/**
 * O avanço das 22h00 é o inicial (0%) e por isso não gera aviso: não existe
 * avanço anterior para comprovar que a operação está em andamento.
 */
export const AVANCO_INICIAL: CampoAvanco = "avanco22h";

/** Avanços que geram aviso 15 min antes, cada um preso ao anterior. */
export const AVANCOS_MONITORADOS: AvancoMonitorado[] = [
  { label: "00h00", hour: 0, minute: 0, campo: "avanco00h", campoAnterior: "avanco22h" },
  { label: "01h00", hour: 1, minute: 0, campo: "avanco01h", campoAnterior: "avanco00h" },
  { label: "03h00", hour: 3, minute: 0, campo: "avanco03h", campoAnterior: "avanco01h" },
  { label: "04h00", hour: 4, minute: 0, campo: "avanco04h", campoAnterior: "avanco03h" },
];

/** Campo preenchido = tem conteúdo. "0" e "0%" contam (são percentuais válidos). */
export function campoPreenchido(valor: unknown): boolean {
  return String(valor ?? "").trim().length > 0;
}

/**
 * O aviso de um avanço só vale quando:
 * 1. o avanço anterior já foi registrado (a operação chegou até aqui) e
 * 2. o próprio avanço ainda está vazio (senão ele já não é o "próximo").
 */
export function avisoLiberado(
  avanco: AvancoMonitorado,
  report: ReportComAvancos | null | undefined,
): boolean {
  if (!report) return false;
  return (
    campoPreenchido(report[avanco.campoAnterior]) &&
    !campoPreenchido(report[avanco.campo])
  );
}

/** Avanços que devem avisar agora, conforme o preenchimento atual. */
export function avancosComAviso(
  report: ReportComAvancos | null | undefined,
): AvancoMonitorado[] {
  return AVANCOS_MONITORADOS.filter((a) => avisoLiberado(a, report));
}

export function buscarAvancoPorLabel(label: string): AvancoMonitorado | null {
  return AVANCOS_MONITORADOS.find((a) => a.label === label) ?? null;
}

/** Horário do aviso: 15 minutos antes do avanço (00h00 → 23h45 do dia anterior). */
export function horarioDoAviso(
  avanco: Pick<AvancoMonitorado, "hour" | "minute">,
): { hour: number; minute: number } {
  const minutos = (avanco.hour * 60 + avanco.minute - 15 + 1440) % 1440;
  return { hour: Math.floor(minutos / 60), minute: minutos % 60 };
}
