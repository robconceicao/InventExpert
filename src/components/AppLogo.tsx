import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

interface AppLogoProps {
  size?: number;
  color?: string;
  glowColor?: string;
  trendColor?: string;
}

export default function AppLogo({
  size = 28,
  color = "#ffffff",
  glowColor = "rgba(96, 165, 250, 0.3)",
  trendColor = "#60A5FA",
}: AppLogoProps) {
  const iconSize = size * 0.75;
  const subIconSize = size * 0.45;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Background soft glow to give a premium feel */}
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
      {/* Primary inventory 3D cube icon */}
      <Ionicons name="cube" size={iconSize} color={color} style={styles.icon} />
      {/* Overlapping growth and optimization trend arrow */}
      <Ionicons
        name="trending-up"
        size={subIconSize}
        color={trendColor}
        style={styles.subIcon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  glow: {
    position: "absolute",
    transform: [{ scale: 1.2 }],
  },
  icon: {
    position: "absolute",
  },
  subIcon: {
    position: "absolute",
    bottom: -1,
    right: -1,
  },
});
