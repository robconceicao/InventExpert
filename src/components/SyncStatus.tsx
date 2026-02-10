import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

export default function SyncStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Monitora a conexão com a internet
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      <Ionicons
        name={isOnline ? "cloud-done" : "cloud-offline"}
        size={20}
        color={isOnline ? "#4ADE80" : "#F87171"} // Verde se online, Vermelho se offline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});
