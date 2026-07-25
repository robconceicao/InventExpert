/**
 * Alarme de avanços (exportar coletores).
 *
 * Regras:
 * - Só agenda/dispara se algum Report A–F estiver em preenchimento.
 * - Se qualquer avanço (ReportA) atingir 100%, cancela e encerra.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  isAdvanceAt100,
  isNearWarningTime,
  isWarningTime,
} from "../utils/advanceAlarmRules";

export type FillingReportId = "A" | "B" | "C" | "D" | "E" | "F";

export {
  isAdvanceAt100,
  isNearWarningTime,
  isWarningTime,
} from "../utils/advanceAlarmRules";

export const ALARM_VOICE_MSG =
  "Solicitar conferentes que exportem os dados dos coletores.";

/** Avanços monitorados para alarme (15 min antes).
 *  O primeiro avanço (22h00) NÃO gera alarme — só a partir de 00h00. */
export const MONITORED_ADVANCES = [
  { label: "00h00", hour: 0, minute: 0, field: "avanco00h" as const },
  { label: "01h00", hour: 1, minute: 0, field: "avanco01h" as const },
  { label: "03h00", hour: 3, minute: 0, field: "avanco03h" as const },
  { label: "04h00", hour: 4, minute: 0, field: "avanco04h" as const },
];

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

/** Agenda alarmes diários 15 min antes de cada avanço (só se permitido). */
export async function scheduleAdvanceAlarms(): Promise<void> {
  if (Platform.OS === "web") return;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    console.warn("[advanceAlarm] Permissão de notificação negada.");
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("alarms", {
      name: "Alarme de Avanços",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7A",
      sound: "default",
    });
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const adv of MONITORED_ADVANCES) {
    let alarmHour = adv.hour;
    let alarmMinute = adv.minute - 15;
    if (alarmMinute < 0) {
      alarmMinute += 60;
      alarmHour -= 1;
      if (alarmHour < 0) alarmHour += 24;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `⏰ Avanço ${adv.label} em 15 minutos`,
          body: ALARM_VOICE_MSG,
          sound: true,
          data: { label: adv.label, type: "advance_alarm" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: alarmHour,
          minute: alarmMinute,
          channelId: "alarms",
        } as Notifications.NotificationTriggerInput,
      });
    } catch (err) {
      console.warn(`[advanceAlarm] Erro ao agendar ${adv.label}:`, err);
    }
  }
  await AsyncStorage.setItem(SCHEDULED_FLAG, "1");
  console.log("[advanceAlarm] Alarmes diários agendados (A–F em preenchimento).");
}

/**
 * Decide se deve agendar ou cancelar com base em:
 * - algum A–F em preenchimento
 * - não ter parado por 100%
 */
export async function syncAdvanceAlarms(): Promise<void> {
  if (await isStoppedDueTo100()) {
    await cancelAdvanceAlarms();
    return;
  }
  if (await hasAnyReportFilling()) {
    await scheduleAdvanceAlarms();
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
