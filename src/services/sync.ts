import AsyncStorage from "@react-native-async-storage/async-storage";
const SYNC_QUEUE_KEY = "inventexpert:sync_queue";
export const enqueueSyncItem = async (type: string, payload: any) => {
  try {
    const currentQueue = JSON.parse(
      (await AsyncStorage.getItem(SYNC_QUEUE_KEY)) || "[]",
    );
    currentQueue.push({
      id: Date.now().toString(),
      type,
      payload,
      createdAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(currentQueue));
  } catch (e) {
    console.error("[SYNC] Erro:", e);
  }
};
export const syncQueue = async () => {
  console.log("[SYNC] Sincronização executada (Simulação).");
};
