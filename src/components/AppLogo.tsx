import React from "react";
import { Image, StyleSheet, View } from "react-native";

interface AppLogoProps {
  size?: number;
  color?: string;
  glowColor?: string;
  trendColor?: string;
}

export default function AppLogo({
  size = 28,
  glowColor = "rgba(96, 165, 250, 0.3)",
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
      <Image
        source={require("../../assets/images/app-logo.png")}
        style={{ width: size, height: size, resizeMode: "contain" }}
      />
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
