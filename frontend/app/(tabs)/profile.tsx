import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Txt, Display, Icon, Card, Badge, Btn } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const ROLE_LABEL: any = { renter: "Trucker", owner: "Fleet Owner", vendor: "Service Company", admin: "Administrator" };

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, refresh } = useAuth();
  const [rate, setRate] = useState(0.15);
  const [payoutStatus, setPayoutStatus] = useState<{ connected: boolean; charges_enabled: boolean }>({ connected: false, charges_enabled: false });
  const [connectBusy, setConnectBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    refresh();
    apiFetch<any>("/settings", { auth: false }).then((s) => setRate(s.commission_rate)).catch(() => {});
    apiFetch<any>("/stripe/status").then(setPayoutStatus).catch(() => {});
  }, []));

  const updateRate = async (delta: number) => {
    const next = Math.min(0.5, Math.max(0, +(rate + delta).toFixed(2)));
    setRate(next);
    try { await apiFetch("/settings", { method: "POST", body: { commission_rate: next } }); } catch {}
  };

  if (!user) return null;
  const isRenter = user.role === "renter";
  const isAdmin = user.role === "admin";
  const receivesPayouts = user.role === "owner" || user.role === "vendor";

  const connectPayouts = async () => {
    setConnectBusy(true);
    try {
      const res = await apiFetch<{ onboarding_url: string }>("/stripe/connect", { method: "POST" });
      await Linking.openURL(res.onboarding_url);
    } catch {}
    finally { setConnectBusy(false); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.avatar}>
          <Icon name="account" size={40} color={colors.brand} />
        </View>
        <Display size={type.huge}>{user.name}</Display>
        <Txt color={colors.onSurfaceSecondary}>{user.email}</Txt>
        <Badge label={ROLE_LABEL[user.role]} tone="brand" />
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        {isRenter && (
          <Card style={{ gap: spacing.md }}>
            <Display size={type.lg}>DOCUMENTS</Display>
            <StatusRow label="Driver License" ok={user.license_verified} />
            <StatusRow label="Insurance Proof" ok={user.insurance_verified} />
            <Btn title="Manage Verification" icon="shield-check" variant="secondary" onPress={() => router.push("/verify")} testID="manage-verify-btn" />
          </Card>
        )}

        {isAdmin && (
          <Card style={{ gap: spacing.md }}>
            <Display size={type.lg}>PLATFORM COMMISSION</Display>
            <Txt size={type.sm} color={colors.onSurfaceSecondary}>The cut RigRent takes on every booking. Owners keep the rest.</Txt>
            <View style={styles.stepper}>
              <Pressable testID="rate-minus" onPress={() => updateRate(-0.01)} style={styles.stepBtn}><Icon name="minus" size={22} color={colors.onSurface} /></Pressable>
              <View style={{ alignItems: "center" }}>
                <Display size={type.huge} color={colors.brand}>{Math.round(rate * 100)}%</Display>
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>Owner keeps {Math.round((1 - rate) * 100)}%</Txt>
              </View>
              <Pressable testID="rate-plus" onPress={() => updateRate(0.01)} style={styles.stepBtn}><Icon name="plus" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <Btn title="Review Verifications" icon="clipboard-check" variant="secondary" onPress={() => router.push("/admin")} testID="admin-review-btn" />
          </Card>
        )}

        {receivesPayouts && (
          <Card style={{ gap: spacing.md }}>
            <Display size={type.lg}>PAYOUTS</Display>
            {payoutStatus.charges_enabled ? (
              <>
                <StatusRow label="Stripe payouts" ok={true} />
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>You're set up to receive payments directly to your bank account.</Txt>
              </>
            ) : (
              <>
                <StatusRow label="Stripe payouts" ok={false} />
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>Connect a Stripe account so renters can pay you directly through the app.</Txt>
                <Btn title={payoutStatus.connected ? "Finish Stripe Setup" : "Connect Payouts"} icon="bank" variant="secondary" onPress={connectPayouts} loading={connectBusy} testID="connect-payouts-btn" />
              </>
            )}
          </Card>
        )}

        <Card style={{ gap: spacing.md }}>
          <Display size={type.lg}>HOW SPLITS WORK</Display>
          <Txt color={colors.onSurfaceTertiary} style={{ lineHeight: 22 }}>
            Every booking is split automatically: the truck or trailer owner earns the majority, and RigRent keeps a small platform fee ({Math.round(rate * 100)}%). Payment is processed securely through Stripe and split at checkout.
          </Txt>
        </Card>

        <Btn title="Log Out" icon="logout" variant="ghost" onPress={async () => { await logout(); router.replace("/auth"); }} testID="logout-btn" />
      </View>
    </ScrollView>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Txt>{label}</Txt>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name={ok ? "check-circle" : "close-circle"} size={18} color={ok ? colors.success : colors.onSurfaceSecondary} />
        <Txt size={type.sm} color={ok ? colors.success : colors.onSurfaceSecondary} weight="bold">{ok ? "Verified" : "Pending"}</Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 80, height: 80, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  stepBtn: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
});
