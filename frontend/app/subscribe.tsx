import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, Linking, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Txt, Display, Btn, Icon, Loader, Badge } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

type Tier = {
  name: string;
  price?: number;
  price_per_truck?: number;
  truck_limit: number | null;
};

const TIER_ORDER = ["starter", "growth", "enterprise"] as const;
const TIER_ICON: Record<string, string> = { starter: "truck-outline", growth: "truck-fast-outline", enterprise: "domain" };
const TIER_BLURB: Record<string, string> = {
  starter: "For a small fleet just getting started.",
  growth: "For growing fleets that have outgrown Starter.",
  enterprise: "No cap — pay only for the trucks you list.",
};

export default function Subscribe() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [tiers, setTiers] = useState<Record<string, Tier> | null>(null);
  const [driverSeatPrice, setDriverSeatPrice] = useState<number>(2.99);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [tiersRes, statusRes] = await Promise.all([
      apiFetch<{ tiers: Record<string, Tier>; driver_seat_price: number }>("/subscription/tiers"),
      apiFetch<any>("/subscription/status"),
    ]);
    setTiers(tiersRes.tiers);
    setDriverSeatPrice(tiersRes.driver_seat_price);
    setStatus(statusRes);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const subscribe = async (tierKey: string) => {
    setError("");
    setBusyTier(tierKey);
    try {
      const res = await apiFetch<{ checkout_url: string }>("/subscribe", { method: "POST", body: { tier: tierKey } });
      await Linking.openURL(res.checkout_url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyTier(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Display size={type.xl}>PLANS</Display>
        <View style={{ width: 40 }} />
      </View>
      {loading || !tiers ? (
        <Loader />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
          <Txt color={colors.onSurfaceSecondary} style={{ lineHeight: 22 }}>
            RigRent charges owners a flat monthly subscription instead of taking a cut of every rental — you keep 100% of what renters pay. Pick the plan that fits your fleet.
          </Txt>

          {status?.subscription_status === "active" ? (
            <View style={styles.currentBanner}>
              <Icon name="check-circle" size={20} color={colors.success} />
              <Txt weight="medium" color={colors.success}>
                Current plan: {tiers[status.subscription_tier]?.name ?? status.subscription_tier} · {status.truck_count} truck{status.truck_count === 1 ? "" : "s"} listed
              </Txt>
            </View>
          ) : null}

          {TIER_ORDER.map((key) => {
            const tier = tiers[key];
            if (!tier) return null;
            const isCurrent = status?.subscription_status === "active" && status?.subscription_tier === key;
            const isEnterprise = key === "enterprise";
            return (
              <View key={key} style={[styles.card, isCurrent && styles.cardActive]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View style={styles.iconWrap}>
                    <Icon name={TIER_ICON[key]} size={22} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Display size={type.lg}>{tier.name}</Display>
                    <Txt size={type.sm} color={colors.onSurfaceSecondary}>{TIER_BLURB[key]}</Txt>
                  </View>
                  {isCurrent ? <Badge label="Current" tone="success" /> : null}
                </View>

                <View style={styles.priceRow}>
                  {isEnterprise ? (
                    <>
                      <Display size={type.xxl}>${tier.price_per_truck?.toFixed(2)}</Display>
                      <Txt color={colors.onSurfaceSecondary}>/truck/mo</Txt>
                    </>
                  ) : (
                    <>
                      <Display size={type.xxl}>${tier.price?.toFixed(2)}</Display>
                      <Txt color={colors.onSurfaceSecondary}>/mo</Txt>
                    </>
                  )}
                </View>
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>
                  {isEnterprise ? "Uncapped trucks/trailers — billed per truck listed" : `Up to ${tier.truck_limit} trucks/trailers`}
                </Txt>

                <Btn
                  title={isCurrent ? "Current Plan" : `Choose ${tier.name}`}
                  variant={isCurrent ? "secondary" : "primary"}
                  disabled={isCurrent}
                  loading={busyTier === key}
                  onPress={() => subscribe(key)}
                  testID={`subscribe-${key}-btn`}
                />
              </View>
            );
          })}

          <View style={styles.driverNote}>
            <Icon name="account-hard-hat-outline" size={20} color={colors.onSurfaceSecondary} />
            <Txt size={type.sm} color={colors.onSurfaceSecondary} style={{ flex: 1, lineHeight: 20 }}>
              Hiring drivers through RigRent's driver marketplace is billed separately: ${driverSeatPrice.toFixed(2)}/month for each driver currently on your active roster. This doesn't affect drivers' own free access to RigRent — they can always browse jobs and rent trucks/trailers as a renter regardless of roster status.
            </Txt>
          </View>

          {error ? <Txt color={colors.error} size={type.sm}>{error}</Txt> : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  currentBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.lg, padding: spacing.md },
  card: { gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardActive: { borderColor: colors.success },
  iconWrap: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: spacing.xs },
  driverNote: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
});
