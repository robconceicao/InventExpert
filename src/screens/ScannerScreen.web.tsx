/**
 * Web stub for ScannerScreen.
 * The document scanner uses native-only modules (react-native-document-scanner-plugin)
 * that cannot run in a browser. This tab is hidden on web via RootTabs.tsx,
 * but Metro requires a resolvable module — this stub satisfies that.
 */
import React from "react";
import { Text, View } from "react-native";

export default function ScannerScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Scanner não disponível na versão web.</Text>
    </View>
  );
}
