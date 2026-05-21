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
  color = "#ffffff",
  glowColor = "rgba(96, 165, 250, 0.3)",
}: AppLogoProps) {
  // Use the white-lined logo when color requested is white (usually means dark/blue background)
  const isWhite = color === "#fff" || color === "#ffffff" || color.toLowerCase() === "white";
  
  const source = isWhite
    ? require("../../assets/images/logo-white.jpg")
    : require("../../assets/images/logo-blue.jpg");

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
        source={source}
        style={{ width: size, height: size, resizeMode: "contain" }}
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
});
