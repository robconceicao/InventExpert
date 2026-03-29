import React from "react";
import { Platform, View } from "react-native";

interface WebLayoutProps {
  children: React.ReactNode;
}

/**
 * On web, centers content with a max-width for responsive desktop layout.
 * On native, renders children as-is.
 */
export function WebLayout({ children }: WebLayoutProps) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }
  return (
    <View style={{ flex: 1, backgroundColor: "#E8EEF6", alignItems: "center" }}>
      <View
        style={{
          width: "100%",
          maxWidth: 720,
          flex: 1,
          backgroundColor: "#F8FAFC",
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        {children}
      </View>
    </View>
  );
}
