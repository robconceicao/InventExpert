import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getSyncQueueLength, syncQueue } from "../services/sync";
import { registerDefaultSyncHandlers } from "../services/syncHandlers";

/**
 * Conectividade + badge da fila local.
 * Toque (quando há pendentes) tenta flush via handlers registados.
 */
export default function SyncStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState(0);

  const refreshPending = useCallback(() => {
    void getSyncQueueLength().then(setPending);
  }, []);

  useEffect(() => {
    registerDefaultSyncHandlers();
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected;
      setIsOnline(online);
      if (online) {
        void syncQueue().then(refreshPending);
      }
    });
    refreshPending();
    const interval = setInterval(refreshPending, 15_000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [refreshPending]);

  const onPress = () => {
    if (pending <= 0) return;
    void syncQueue().then((r) => {
      refreshPending();
      if (__DEV__ && r.message) {
        console.log("[SYNC]", r.message);
      }
    });
  };

  const color = !isOnline
    ? "#F87171"
    : pending > 0
      ? "#FBBF24"
      : "#4ADE80";
  const icon = !isOnline
    ? "cloud-offline"
    : pending > 0
      ? "cloud-upload-outline"
      : "cloud-done";

  return (
    <Pressable
      onPress={onPress}
      style={styles.container}
      accessibilityLabel={
        !isOnline
          ? "Offline"
          : pending > 0
            ? `${pending} itens pendentes de sincronização`
            : "Online, fila vazia"
      }
    >
      <Ionicons name={icon} size={20} color={color} />
      {pending > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {pending > 9 ? "9+" : String(pending)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 32,
    minHeight: 28,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 2,
    backgroundColor: "#DC2626",
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
});
