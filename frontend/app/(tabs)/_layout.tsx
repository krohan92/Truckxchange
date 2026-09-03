import React from "react";
import { Platform } from "react-native";
import { Tabs, Redirect } from "expo-router";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { useAuth } from "@/src/context/AuthContext";
import { Loader } from "@/src/ui";
import { colors, fonts } from "@/src/theme";

const Icon = MDIcon as any;

export default function TabsLayout() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Redirect href="/auth" />;

  const role = user.role;
  const show = (roles: string[]) => (roles.includes(role) ? undefined : null);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.onSurfaceSecondary,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.displaySemi, fontSize: 11, letterSpacing: 0.4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ href: show(["renter", "admin"]), title: "Market", tabBarIcon: ({ color, size }) => <Icon name="storefront-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="trips"
        options={{ href: show(["renter"]), title: "Trips", tabBarIcon: ({ color, size }) => <Icon name="road-variant" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{ href: show(["owner"]), title: "Dashboard", tabBarIcon: ({ color, size }) => <Icon name="view-dashboard-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="rigs"
        options={{ href: show(["owner"]), title: "My Rigs", tabBarIcon: ({ color, size }) => <Icon name="truck-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="roadside"
        options={{ href: show(["renter", "owner", "vendor", "admin"]), title: role === "vendor" ? "Jobs" : "Roadside", tabBarIcon: ({ color, size }) => <Icon name="wrench-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: undefined, title: "Profile", tabBarIcon: ({ color, size }) => <Icon name="account-circle-outline" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
