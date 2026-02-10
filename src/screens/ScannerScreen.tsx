import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera"; // USAR ESSA IMPORTAÇÃO
import React, { useEffect, useLayoutEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const HeaderIcon = require("../../assets/images/splash-icon.png");

export default function ScannerScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions(); // Hook novo
  const [scannedData, setScannedData] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    setScannedData(data);
    Alert.alert("Código Escaneado!", `Tipo: ${type}\nConteúdo: ${data}`, [
      { text: "OK", onPress: () => setScannedData(null) },
    ]);
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text>Precisamos de acesso à câmera</Text>
        <Pressable onPress={requestPermission} style={styles.btn}>
          <Text style={styles.btnTxt}>Conceder Permissão</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />
      <View style={styles.header}>
        <Image
          source={HeaderIcon}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>Scanner</Text>
      </View>

      <View style={styles.container}>
        {/* COMPONENTE NOVO */}
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scannedData ? undefined : handleBarCodeScanned}
        />

        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanText}>Aponte para o código de barras</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    padding: 16,
  },
  headerLogo: { width: 32, height: 32, marginRight: 10, borderRadius: 6 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  container: { flex: 1, backgroundColor: "#000" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  btn: {
    padding: 15,
    backgroundColor: "#2563EB",
    borderRadius: 8,
    marginTop: 20,
  },
  btnTxt: { color: "#fff", fontWeight: "bold" },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  scanText: {
    color: "#fff",
    marginTop: 20,
    fontSize: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 5,
  },
});
