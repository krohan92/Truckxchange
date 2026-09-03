import React, { useState } from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/src/context/AuthContext";
import { Btn, Field, Txt, Display, Icon } from "@/src/ui";
import { colors, spacing, radius, fonts, type } from "@/src/theme";

const HERO = "https://images.unsplash.com/photo-1778103617525-76877c583fa5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
const { height } = Dimensions.get("window");

const ROLES = [
  { key: "renter", label: "Trucker", desc: "Rent trucks & trailers", icon: "steering" },
  { key: "owner", label: "Owner", desc: "List your rigs, earn", icon: "truck" },
  { key: "vendor", label: "Service Co.", desc: "Bid on tow & repair jobs", icon: "wrench" },
];

export default function Auth() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, register, loginAs } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState("renter");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const quick = async (r: "renter" | "owner" | "vendor" | "admin") => {
    setError("");
    setBusy(true);
    try {
      await loginAs(r);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        if (!name.trim()) throw new Error("Please enter your name");
        await register(name.trim(), email.trim(), password, role);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["rgba(15,15,18,0.2)", colors.surface]} style={StyleSheet.absoluteFill} />
        <View style={[styles.brandRow, { top: insets.top + spacing.lg }]}>
          <View style={styles.logoBadge}>
            <Icon name="truck-fast" size={22} color={colors.onBrand} />
          </View>
          <Display size={type.xxl} style={{ letterSpacing: 1 }}>RIGRENT</Display>
        </View>
      </View>

      <KeyboardAwareScrollView
        style={styles.sheet}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.lg }}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Display size={type.huge}>{mode === "login" ? "Welcome back" : "Join the fleet"}</Display>
          <Txt color={colors.onSurfaceSecondary} style={{ marginTop: 4 }}>
            {mode === "login" ? "Sign in to book or manage your rigs" : "Rent, list, or service heavy machinery"}
          </Txt>
        </View>

        <View style={styles.toggle}>
          {(["login", "register"] as const).map((m) => (
            <Pressable key={m} testID={`mode-${m}`} onPress={() => setMode(m)} style={[styles.toggleBtn, mode === m && styles.toggleActive]}>
              <Txt weight="bold" color={mode === m ? colors.onBrand : colors.onSurfaceSecondary}>
                {m === "login" ? "Sign In" : "Create Account"}
              </Txt>
            </Pressable>
          ))}
        </View>

        {mode === "register" && (
          <View style={{ gap: spacing.sm }}>
            <Txt size={type.sm} color={colors.onSurfaceSecondary} weight="medium">I am a</Txt>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {ROLES.map((r) => (
                <Pressable
                  key={r.key}
                  testID={`role-${r.key}`}
                  onPress={() => {
                    setRole(r.key);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  }}
                  style={[styles.roleCard, role === r.key && styles.roleActive]}
                >
                  <Icon name={r.icon} size={24} color={role === r.key ? colors.brand : colors.onSurfaceSecondary} />
                  <Txt weight="bold" size={type.base} color={role === r.key ? colors.onSurface : colors.onSurfaceSecondary}>{r.label}</Txt>
                  <Txt size={10} color={colors.onSurfaceSecondary} style={{ textAlign: "center" }}>{r.desc}</Txt>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {mode === "register" && (
          <Field label="Full name" placeholder="John Trucker" value={name} onChangeText={setName} testID="input-name" />
        )}
        <Field label="Email" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} testID="input-email" />
        <Field label="Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} testID="input-password" />

        {error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={16} color={colors.error} />
            <Txt color={colors.error} size={type.sm} style={{ flex: 1 }}>{error}</Txt>
          </View>
        ) : null}

        <Btn title={mode === "login" ? "Sign In" : "Create Account"} onPress={submit} loading={busy} testID="submit-auth" />

        <View style={styles.divider}>
          <View style={styles.line} />
          <Txt size={type.sm} color={colors.onSurfaceSecondary}>quick test access</Txt>
          <View style={styles.line} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {[
            { r: "renter", label: "Trucker", icon: "steering" },
            { r: "owner", label: "Owner", icon: "truck" },
            { r: "vendor", label: "Service Co.", icon: "wrench" },
            { r: "admin", label: "Admin", icon: "shield-account" },
          ].map((q) => (
            <Pressable key={q.r} testID={`quick-${q.r}`} onPress={() => quick(q.r as any)} style={styles.quickBtn}>
              <Icon name={q.icon} size={18} color={colors.brand} />
              <Txt weight="bold" size={type.sm}>{q.label}</Txt>
            </Pressable>
          ))}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { height: height * 0.34 },
  brandRow: { position: "absolute", left: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoBadge: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  sheet: { flex: 1, marginTop: -spacing.xxl },
  toggle: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  toggleBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: radius.sm },
  toggleActive: { backgroundColor: colors.brand },
  roleCard: {
    flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, alignItems: "center", gap: 6, minHeight: 92, justifyContent: "center",
  },
  roleActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  errorBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(239,68,68,0.1)", padding: spacing.md, borderRadius: radius.md },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  quickBtn: {
    flexGrow: 1, flexBasis: "47%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
});
