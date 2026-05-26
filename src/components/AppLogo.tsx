import React from "react";
import { Image, StyleSheet, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

interface AppLogoProps {
  size?: number;
  color?: string;
  glowColor?: string;
  trendColor?: string;
}

export default function AppLogo({
  size = 28,
  color = "#fff",
  glowColor = "rgba(255, 255, 255, 0.15)",
}: AppLogoProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[
          styles.glow,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: glowColor,
          },
        ]}
      />
      <Ionicons name="cube-outline" size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  glow: {
    position: "absolute",
    transform: [{ scale: 1.2 }],
  },
});
