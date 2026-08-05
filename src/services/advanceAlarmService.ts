/**
 * Alarme de avanços (exportar coletores).
 *
 * Regras:
 * - Só agenda/dispara se algum Report A–F estiver em preenchimento.
 * - Só avisa o avanço cujo **avanço anterior já está preenchido** — é ele que
 *   comprova que a operação chegou até ali. O avanço das 22h00 nunca avisa:
 *   é o inicial (0%) e não tem anterior.
 * - Se qualquer avanço (ReportA) atingir 100%, cancela e encerra.
 *
 * Tela apagada: o texto e a voz saem pela notificação agendada no SO — canal
 * de importância máxima, visível na tela de bloqueio e com o som da voz
 * gravada (ver docs/AVISO_VOZ_ELEVENLABS.md).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  AVANCOS_MONITORADOS,
  avancosComAviso,
  horarioDoAviso,
  isAdvanceAt100,
  type AvancoMonitorado,
  type ReportComAvancos,
} from "../utils/advanceAlarmRules";

export type FillingReportId = "A" | "B" | "C" | "D" | "E" | "F";

export {
  AVANCOS_MONITORADOS,
  avancosComAviso,
  avisoLiberado,
  buscarAvancoPorLabel,
  campoPreenchido,
  horarioDoAviso,
  isAdvanceAt100,
  isNearWarningTime,
  isWarningTime,
  type AvancoMonitorado,
} from "../utils/advanceAlarmRules";

/** Texto único do aviso — notificação, banner na tela e voz falam o mesmo. */
export const ALARM_VOICE_MSG =
  "Atenção, estamos a quinze minutos do próximo avanço. Solicite aos conferentes que exportem os dados do coletor.";

export const ALARM_TITLE = "⏰ Próximo avanço em 15 minutos";

/**
 * Som customizado da notificação = voz masculina gravada no ElevenLabs.
 *
 * O arquivo precisa existir em assets/sounds/aviso_avanco.mp3 e estar
 * registrado no plugin expo-notifications do app.json — sem ele o build falha
 * ao copiar o som para res/raw. Ver docs/AVISO_VOZ_ELEVENLABS.md.
 *
 * MP3 serve: no Android o recurso é resolvido pelo nome base, sem a extensão
 * (SoundResolver.filenameToBasename). iOS exigiria WAV/AIFF/CAF.
 */
export const SOM_AVISO: string | null = "aviso_avanco.mp3";

/** `sound` aceito pelo expo-notifications: nome do arquivo ou som padrão. */
function somDaNotificacao(): string {
  return SOM_AVISO ?? "default";
}

/** ReportA persistido pela tela — fonte do preenchimento dos avanços. */
const REPORT_A_KEY = "inventexpert:reportA";
const FILLING_KEY = "inventexpert:alarm:fillingReports";
const STOPPED_100_KEY = "inventexpert:alarm:stopped100Date";
const SCHEDULED_FLAG = "inventexpert:alarm:scheduled";

async function getFillingSet(): Promise<Set<FillingReportId>> {
  try {
    const raw = await AsyncStorage.getItem(FILLING_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as FillingReportId[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

async function saveFillingSet(set: Set<FillingReportId>): Promise<void> {
  await AsyncStorage.setItem(FILLING_KEY, JSON.stringify([...set]));
}

export async function isStoppedDueTo100(): Promise<boolean> {
  try {
    const d = await AsyncStorage.getItem(STOPPED_100_KEY);
    return d === new Date().toDateString();
  } catch {
    return false;
  }
}

export async function markStoppedDueTo100(): Promise<void> {
  await AsyncStorage.setItem(STOPPED_100_KEY, new Date().toDateString());
  await cancelAdvanceAlarms();
  console.log("[advanceAlarm] Encerrado: algum avanço atingiu 100%.");
}

/** Marca Report A–F como em preenchimento (ou remove). Reagenda conforme regra. */
export async function setReportFilling(
  id: FillingReportId,
  filling: boolean,
): Promise<void> {
  const set = await getFillingSet();
  if (filling) set.add(id);
  else set.delete(id);
  await saveFillingSet(set);
  await syncAdvanceAlarms();
}

export async function hasAnyReportFilling(): Promise<boolean> {
  const set = await getFillingSet();
  return set.size > 0;
}

/** Lê o ReportA salvo para avaliar quais avanços já foram registrados. */
export async function lerAvancosSalvos(): Promise<ReportComAvancos | null> {
  try {
    const raw = await AsyncStorage.getItem(REPORT_A_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReportComAvancos;
  } catch {
    return null;
  }
}

/** Cancela todos os alarmes agendados no SO. */
export async function cancelAdvanceAlarms(): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(SCHEDULED_FLAG, "0");
    return;
  }
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn("[advanceAlarm] Erro ao cancelar:", err);
  }
  await AsyncStorage.setItem(SCHEDULED_FLAG, "0");
  console.log("[advanceAlarm] Alarmes cancelados.");
}

/** Registra o canal Android do alarme (importância máxima + tela de bloqueio). */
export async function garantirCanalDeAlarme(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("alarms", {
    name: "Alarme de Avanços",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF231F7A",
    sound: somDaNotificacao(),
    // Mostra o texto completo com o aparelho bloqueado
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
    showBadge: true,
  });
}

/**
 * Agenda alarmes diários 15 min antes de cada avanço liberado.
 * Só entram os avanços cujo anterior já está preenchido — 22h00 nunca entra.
 */
export async function scheduleAdvanceAlarms(
  report?: ReportComAvancos | null,
): Promise<void> {
  if (Platform.OS === "web") return;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    console.warn("[advanceAlarm] Permissão de notificação negada.");
    return;
  }

  await garantirCanalDeAlarme();
  await Notifications.cancelAllScheduledNotificationsAsync();

  const avancos = avancosComAviso(report ?? (await lerAvancosSalvos()));
  if (avancos.length === 0) {
    await AsyncStorage.setItem(SCHEDULED_FLAG, "0");
    console.log(
      "[advanceAlarm] Nenhum avanço liberado — aguardando o avanço anterior ser preenchido.",
    );
    return;
  }

  for (const adv of avancos) {
    const { hour, minute } = horarioDoAviso(adv);
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: ALARM_TITLE,
          subtitle: `Avanço ${adv.label}`,
          body: ALARM_VOICE_MSG,
          sound: somDaNotificacao(),
          // iOS: fura Foco/Não perturbe, como alarme operacional
          interruptionLevel: "timeSensitive",
          data: { label: adv.label, type: "advance_alarm" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: "alarms",
        } as Notifications.NotificationTriggerInput,
      });
    } catch (err) {
      console.warn(`[advanceAlarm] Erro ao agendar ${adv.label}:`, err);
    }
  }
  await AsyncStorage.setItem(SCHEDULED_FLAG, "1");
  console.log(
    "[advanceAlarm] Agendados:",
    avancos.map((a) => a.label).join(", "),
  );
}

/**
 * Decide se deve agendar ou cancelar com base em:
 * - algum A–F em preenchimento
 * - não ter parado por 100%
 * - haver avanço liberado pelo preenchimento do anterior
 */
export async function syncAdvanceAlarms(
  report?: ReportComAvancos | null,
): Promise<void> {
  if (await isStoppedDueTo100()) {
    await cancelAdvanceAlarms();
    return;
  }
  if (await hasAnyReportFilling()) {
    await scheduleAdvanceAlarms(report);
  } else {
    await cancelAdvanceAlarms();
  }
}

/**
 * Avalia avanços do ReportA. Se algum ≥ 100%, encerra alarmes.
 * Retorna true se encerrou.
 */
export async function evaluateAdvancesAndMaybeStop(report: {
  avanco22h?: string;
  avanco00h?: string;
  avanco01h?: string;
  avanco03h?: string;
  avanco04h?: string;
  avancoExtraValor?: string;
}): Promise<boolean> {
  const hit = isAdvanceAt100(
    report.avanco22h,
    report.avanco00h,
    report.avanco01h,
    report.avanco03h,
    report.avanco04h,
    report.avancoExtraValor,
  );
  if (hit) {
    await markStoppedDueTo100();
    return true;
  }
  return false;
}

/** true se o alarme pode disparar agora (preenchendo A–F e sem 100%). */
export async function canTriggerAdvanceAlarm(): Promise<boolean> {
  if (await isStoppedDueTo100()) return false;
  return hasAnyReportFilling();
}

/** Alarmes agendados no SO — usado para conferir o estado atual. */
export async function listarAlarmesAgendados(): Promise<AvancoMonitorado[]> {
  const report = await lerAvancosSalvos();
  return avancosComAviso(report);
}

/** Todos os avanços monitorados (22h00 não está na lista, é o inicial). */
export function todosAvancosMonitorados(): AvancoMonitorado[] {
  return AVANCOS_MONITORADOS;
}
