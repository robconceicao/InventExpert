import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  const iconColor = isWhite ? "#ffffff" : "#2563EB";
  const bgColor = isWhite ? "#2563EB" : "#ffffff";

  const clipboardSize = size * 0.85;
  const checkSize = size * 0.5;
  const bulbSize = size * 0.45;

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
      
      {/* Composição Vetorial do Logo (Clipboard + Check + Bulb) */}
      <View style={{ width: clipboardSize, height: clipboardSize, position: 'relative', top: size * 0.05, alignItems: 'center' }}>
        <Ionicons 
          name="clipboard-outline" 
          size={clipboardSize} 
          color={iconColor} 
          style={{ position: 'absolute', top: 0 }}
        />
        <Ionicons 
          name="checkmark" 
          size={checkSize} 
          color={iconColor} 
          style={{ position: 'absolute', top: clipboardSize * 0.35 }}
        />
        {/* Fundo para esconder a borda de cima da prancheta sob a lâmpada */}
        <View style={{ 
          position: 'absolute', 
          top: -bulbSize * 0.4, 
          backgroundColor: bgColor, 
          borderRadius: bulbSize, 
          padding: 2 
        }}>
          <Ionicons 
            name="bulb-outline" 
            size={bulbSize} 
            color={iconColor} 
          />
        </View>
      </View>
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
