import React from "react";
import { Stack } from "expo-router";
import { LogBox, View, Platform, useWindowDimensions } from "react-native";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AuthProvider } from "@/src/context/AuthContext";
import { PushRegistrar } from "@/src/hooks/usePushRegistration";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);

const WIDE_BREAKPOINT = 560;
const PHONE_FRAME_WIDTH = 480;

// On wide (laptop/desktop) browser windows, center the app in a phone-width
// column instead of stretching it full-bleed. On phones and narrow windows
// it renders exactly as before, edge-to-edge.
function ResponsiveShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === "web" && width >= WIDE_BREAKPOINT;

  if (!isWideWeb) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }}>{children}</View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary, alignItems: "center" }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: PHONE_FRAME_WIDTH,
          backgroundColor: colors.surface,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: colors.border,
        }}
      >
        {children}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    "Rajdhani-Medium": require("../assets/fonts/Rajdhani-Medium.ttf"),
    "Rajdhani-SemiBold": require("../assets/fonts/Rajdhani-SemiBold.ttf"),
    "Rajdhani-Bold": require("../assets/fonts/Rajdhani-Bold.ttf"),
    "Manrope": require("../assets/fonts/Manrope-Var.ttf"),
    "MaterialDesignIcons": require("@react-native-vector-icons/material-design-icons/fonts/MaterialDesignIcons.ttf"),
  });

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <AuthProvider>
            <PushRegistrar />
            <StatusBar style="light" />
            <ResponsiveShell>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, animation: "slide_from_right" }} />
            </ResponsiveShell>
          </AuthProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
