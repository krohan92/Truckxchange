import React from "react";
import {
  Text,
  TextProps,
  Pressable,
  PressableProps,
  View,
  ViewProps,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TextInputProps,
} from "react-native";
import * as Haptics from "expo-haptics";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { colors, spacing, radius, fonts, type } from "@/src/theme";

export const Icon = MDIcon as any;

export function Txt({ style, weight = "regular", size, color, ...rest }: TextProps & { weight?: "regular" | "medium" | "bold"; size?: number; color?: string }) {
  const fam = weight === "bold" ? "Manrope" : "Manrope";
  const fw = weight === "bold" ? "700" : weight === "medium" ? "600" : "400";
  return (
    <Text
      {...rest}
      style={[{ fontFamily: fam, fontWeight: fw as any, color: color || colors.onSurface, fontSize: size || type.base }, style]}
    />
  );
}

export function Display({ style, size, color, ...rest }: TextProps & { size?: number; color?: string }) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: fonts.display, color: color || colors.onSurface, fontSize: size || type.xxl, letterSpacing: 0.3 }, style]}
    />
  );
}

export function Btn({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  style,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: any;
  testID?: string;
}) {
  const bg =
    variant === "primary" ? colors.brand : variant === "danger" ? colors.error : variant === "secondary" ? colors.surfaceTertiary : "transparent";
  const fg = variant === "primary" ? colors.onBrand : variant === "danger" ? "#fff" : colors.onSurface;
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress && onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, borderWidth: variant === "ghost" ? 1 : 0, borderColor: colors.borderStrong },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <Text style={{ color: fg, fontFamily: fonts.displaySemi, fontSize: type.lg, letterSpacing: 0.5 }}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View {...rest} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function Field({ label, style, ...rest }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Txt size={type.sm} color={colors.onSurfaceSecondary} weight="medium">{label}</Txt> : null}
      <TextInput
        placeholderTextColor={colors.onSurfaceSecondary}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        height: 36,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? colors.brand : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.border,
        flexShrink: 0,
      }}
    >
      <Text style={{ color: active ? colors.onBrand : colors.onSurfaceSecondary, fontFamily: fonts.displaySemi, fontSize: type.base, letterSpacing: 0.4 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({ label, tone = "brand" }: { label: string; tone?: "brand" | "success" | "warning" | "error" | "muted" }) {
  const map: any = {
    brand: [colors.brandTertiary, colors.brand],
    success: ["rgba(16,185,129,0.14)", colors.success],
    warning: ["rgba(245,158,11,0.14)", colors.warning],
    error: ["rgba(239,68,68,0.14)", colors.error],
    muted: [colors.surfaceTertiary, colors.onSurfaceSecondary],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontFamily: fonts.displaySemi, fontSize: type.sm, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</Text>
    </View>
  );
}

export function Loader() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
}

export function EmptyState({ icon, title, subtitle, action }: { icon: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.md }}>
      <View style={{ width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={34} color={colors.onSurfaceSecondary} />
      </View>
      <Display size={type.xl} style={{ textAlign: "center" }}>{title}</Display>
      {subtitle ? <Txt color={colors.onSurfaceSecondary} style={{ textAlign: "center" }}>{subtitle}</Txt> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.onSurface,
    fontFamily: "Manrope",
    fontSize: type.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
