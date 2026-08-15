/**
 * Canal de notificação do alarme de avanços.
 *
 * Existe por causa de um bug real: o canal `alarms` foi criado antes de a voz
 * gravada existir e, como canal do Android é imutável, o aviso saiu mudo por
 * várias versões — sem erro nenhum no log. A defesa é o ID carregar o nome do
 * som, para que trocar o áudio crie um canal novo sozinho.
 */

const setChannel = jest.fn().mockResolvedValue(undefined);
const getChannels = jest.fn().mockResolvedValue([]);
const getChannel = jest.fn().mockResolvedValue(null);
const deleteChannel = jest.fn().mockResolvedValue(undefined);
const scheduleNotification = jest.fn().mockResolvedValue("id");
const cancelAll = jest.fn().mockResolvedValue(undefined);

jest.mock("expo-notifications", () => ({
  setNotificationChannelAsync: (...a: unknown[]) => setChannel(...a),
  getNotificationChannelsAsync: () => getChannels(),
  getNotificationChannelAsync: (...a: unknown[]) => getChannel(...a),
  deleteNotificationChannelAsync: (...a: unknown[]) => deleteChannel(...a),
  scheduleNotificationAsync: (...a: unknown[]) => scheduleNotification(...a),
  cancelAllScheduledNotificationsAsync: () => cancelAll(),
  requestPermissionsAsync: async () => ({ status: "granted" }),
  AndroidImportance: { MAX: 5 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  SchedulableTriggerInputTypes: { DAILY: "daily" },
}));

jest.mock("react-native", () => ({ Platform: { OS: "android" } }));

const store: Record<string, string> = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => store[k] ?? null,
    setItem: async (k: string, v: string) => {
      store[k] = v;
    },
  },
}));

import {
  ALARM_CHANNEL_ID,
  SOM_AVISO,
  garantirCanalDeAlarme,
  scheduleAdvanceAlarms,
} from "../advanceAlarmService";

beforeEach(() => {
  jest.clearAllMocks();
  getChannels.mockResolvedValue([]);
});

describe("ALARM_CHANNEL_ID", () => {
  it("carrega o nome base do som, sem extensão", () => {
    const base = (SOM_AVISO ?? "default").replace(/\.[^.]+$/, "");
    expect(ALARM_CHANNEL_ID).toBe(`alarms_${base}`);
    expect(ALARM_CHANNEL_ID).not.toBe("alarms");
  });

  it("é um ID válido para o Android (minúsculas, dígitos e _)", () => {
    expect(ALARM_CHANNEL_ID).toMatch(/^[a-z0-9_]+$/);
  });
});

describe("garantirCanalDeAlarme", () => {
  it("cria o canal com o som configurado e importância máxima", async () => {
    await garantirCanalDeAlarme();

    expect(setChannel).toHaveBeenCalledTimes(1);
    const [id, cfg] = setChannel.mock.calls[0] as [
      string,
      { sound: string; importance: number; lockscreenVisibility: number },
    ];
    expect(id).toBe(ALARM_CHANNEL_ID);
    expect(cfg.sound).toBe(SOM_AVISO ?? "default");
    expect(cfg.importance).toBe(5);
    expect(cfg.lockscreenVisibility).toBe(1);
  });

  it("apaga o canal legado `alarms`, que o sistema nunca atualizaria", async () => {
    getChannels.mockResolvedValue([
      { id: "alarms" },
      { id: "alarms_voz_antiga" },
      { id: ALARM_CHANNEL_ID },
      { id: "default" },
    ]);

    await garantirCanalDeAlarme();

    const apagados = deleteChannel.mock.calls.map((c) => c[0]);
    expect(apagados).toEqual(["alarms", "alarms_voz_antiga"]);
    expect(apagados).not.toContain(ALARM_CHANNEL_ID);
    expect(apagados).not.toContain("default");
  });

  it("não derruba o app se a limpeza de canais falhar", async () => {
    getChannels.mockRejectedValue(new Error("sem permissão"));
    await expect(garantirCanalDeAlarme()).resolves.toBeUndefined();
    expect(setChannel).toHaveBeenCalledTimes(1);
  });
});

describe("scheduleAdvanceAlarms", () => {
  it("agenda no mesmo canal que criou, com o som no conteúdo", async () => {
    // avanço das 00h00 liberado pelo preenchimento das 22h00
    await scheduleAdvanceAlarms({ avanco22h: "10" });

    expect(scheduleNotification).toHaveBeenCalled();
    for (const [req] of scheduleNotification.mock.calls as [
      { content: { sound: string }; trigger: { channelId: string; hour: number; minute: number } },
    ][]) {
      expect(req.trigger.channelId).toBe(ALARM_CHANNEL_ID);
      expect(req.content.sound).toBe(SOM_AVISO ?? "default");
      expect(req.trigger.minute).toBe(45);
    }
  });
});
