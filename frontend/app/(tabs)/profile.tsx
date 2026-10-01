import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useTranslation } from "react-i18next";
import { setLanguage, SupportedLanguage } from "@/src/i18n";
import { Txt, Display, Icon, Card, Badge, Btn, Field } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const ROLE_LABEL: any = { renter: "Trucker", owner: "Fleet Owner", vendor: "Service Company", admin: "Administrator" };

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user, logout, refresh } = useAuth();
  const [roadsideRate, setRoadsideRate] = useState(0.08);
  const [placementFee, setPlacementFee] = useState(49);
  const [payoutStatus, setPayoutStatus] = useState<{ connected: boolean; charges_enabled: boolean }>({ connected: false, charges_enabled: false });
  const [connectBusy, setConnectBusy] = useState(false);
  const [reseedBusy, setReseedBusy] = useState(false);
  const [serviceRadius, setServiceRadius] = useState("50");
  const [serviceAreaBusy, setServiceAreaBusy] = useState(false);
  const [serviceAreaSaved, setServiceAreaSaved] = useState(false);
  const [subStatus, setSubStatus] = useState<any>(null);
  const [subTiers, setSubTiers] = useState<Record<string, any> | null>(null);
  const [driverSeatPrice, setDriverSeatPrice] = useState(2.99);
  const [roster, setRoster] = useState<any[]>([]);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState<string | null>(null);
  const [tierSaving, setTierSaving] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    refresh();
    if (user?.role === "admin") {
      apiFetch<any>("/settings").then((s) => {
        setRoadsideRate(s.roadside_commission_rate);
        setPlacementFee(s.driver_placement_fee);
      }).catch(() => {});
      apiFetch<any>("/subscription/tiers").then((s) => { setSubTiers(s.tiers); setDriverSeatPrice(s.driver_seat_price); }).catch(() => {});
    }
    if (user?.role === "owner") {
      apiFetch<any>("/subscription/status").then(setSubStatus).catch(() => {});
      apiFetch<any>("/subscription/tiers").then((s) => setSubTiers(s.tiers)).catch(() => {});
      apiFetch<any[]>("/roster/mine").then(setRoster).catch(() => {});
    }
    apiFetch<any>("/stripe/status").then(setPayoutStatus).catch(() => {});
  }, [user?.role]));

  const cancelSubscription = async () => {
    setCancelBusy(true);
    try {
      await apiFetch("/subscription/cancel", { method: "POST" });
      setSubStatus((s: any) => ({ ...s, subscription_status: "canceled", subscription_tier: null }));
      await refresh();
    } catch {}
    finally { setCancelBusy(false); }
  };

  const removeDriver = async (driverId: string) => {
    setRemoveBusy(driverId);
    try {
      await apiFetch(`/roster/${driverId}/remove`, { method: "POST" });
      setRoster((r) => r.filter((d) => d.driver_id !== driverId));
    } catch {}
    finally { setRemoveBusy(null); }
  };

  const saveTier = async (key: string, field: string, value: string) => {
    setTierSaving(key);
    try {
      const num = parseFloat(value);
      const body: any = {};
      body[field] = isNaN(num) ? null : num;
      const res = await apiFetch<{ tiers: any }>(`/admin/subscription-tiers/${key}`, { method: "POST", body });
      setSubTiers(res.tiers);
    } catch {}
    finally { setTierSaving(null); }
  };

  const updateRoadsideRate = async (delta: number) => {
    const next = Math.min(0.5, Math.max(0, +(roadsideRate + delta).toFixed(2)));
    setRoadsideRate(next);
    try { await apiFetch("/settings", { method: "POST", body: { roadside_commission_rate: next } }); } catch {}
  };

  const updatePlacementFee = async (delta: number) => {
    const next = Math.max(0, placementFee + delta);
    setPlacementFee(next);
    try { await apiFetch("/settings", { method: "POST", body: { driver_placement_fee: next } }); } catch {}
  };

  if (!user) return null;
  const isRenter = user.role === "renter";
  const isAdmin = user.role === "admin";
  const isVendor = user.role === "vendor";
  const receivesPayouts = user.role === "owner" || user.role === "vendor";

  const connectPayouts = async () => {
    setConnectBusy(true);
    try {
      const res = await apiFetch<{ onboarding_url: string }>("/stripe/connect", { method: "POST" });
      await Linking.openURL(res.onboarding_url);
    } catch {}
    finally { setConnectBusy(false); }
  };

  const saveServiceArea = async () => {
    setServiceAreaBusy(true);
    setServiceAreaSaved(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await apiFetch("/vendor/service-area", {
        method: "POST",
        body: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, radius_mi: parseFloat(serviceRadius) || 50 },
      });
      setServiceAreaSaved(true);
    } catch {}
    finally { setServiceAreaBusy(false); }
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
        {isRenter && user!.renter_rating_count > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <Icon name="star" size={14} color={colors.warning} />
            <Txt size={type.sm} color={colors.onSurfaceSecondary}>{user!.renter_rating!.toFixed(1)} renter rating · {user!.renter_rating_count} trip{user!.renter_rating_count === 1 ? "" : "s"}</Txt>
          </View>
        ) : null}
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

        {isRenter && (
          <Card style={{ gap: spacing.md }}>
            <Display size={type.lg}>DRIVING JOBS</Display>
            <Txt size={type.sm} color={colors.onSurfaceSecondary}>Fill out a driver profile so fleet owners can find and hire you, or browse open jobs.</Txt>
            <Btn title="My Driver Profile" icon="account-hard-hat" variant="secondary" onPress={() => router.push("/driver-profile")} testID="my-driver-profile-btn" />
            <Btn title="Browse Driving Jobs" icon="briefcase-search" variant="ghost" onPress={() => router.push("/driver-jobs")} testID="browse-driver-jobs-btn" />
          </Card>
        )}

        {user.role === "owner" && (
          <Card style={{ gap: spacing.md }}>
            <Display size={type.lg}>SUBSCRIPTION</Display>
            {subStatus?.subscription_status === "active" ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Badge label={subTiers?.[subStatus.subscription_tier]?.name ?? subStatus.subscription_tier} tone="success" />
                  <Txt size={type.sm} color={colors.onSurfaceSecondary}>{subStatus.truck_count} truck{subStatus.truck_count === 1 ? "" : "s"} listed</Txt>
                </View>
                <Btn title="Change Plan" icon="swap-horizontal" variant="secondary" onPress={() => router.push("/subscribe")} testID="change-plan-btn" />
                <Btn title="Cancel Subscription" icon="close-circle-outline" variant="ghost" onPress={cancelSubscription} loading={cancelBusy} testID="cancel-subscription-btn" />
              </>
            ) : (
              <>
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>
                  {subStatus?.subscription_status === "canceled" || subStatus?.subscription_status === "past_due"
                    ? "Your subscription has lapsed — your listings are hidden until you subscribe again."
                    : "An active plan is required to list trucks/trailers. Rental commission is 0% — you keep 100% of every rental."}
                </Txt>
                <Btn title="Choose a Plan" icon="star-outline" onPress={() => router.push("/subscribe")} testID="choose-plan-btn" />
              </>
            )}
          </Card>
        )}

        {user.role === "owner" && (
          <Card style={{ gap: spacing.md }}>
            <Display size={type.lg}>HIRE DRIVERS</Display>
            <Txt size={type.sm} color={colors.onSurfaceSecondary}>Post a free driving job or browse truckers looking for work.</Txt>
            <Btn title="Post a Driving Job" icon="bullhorn" variant="secondary" onPress={() => router.push("/driver-jobs/create")} testID="post-driver-job-btn" />
            <Btn title="Browse Drivers" icon="account-search" variant="ghost" onPress={() => router.push("/drivers")} testID="browse-drivers-btn" />
          </Card>
        )}

        {user.role === "owner" && roster.length > 0 && (
          <Card style={{ gap: spacing.md }}>
            <Display size={type.lg}>YOUR ROSTER</Display>
            <Txt size={type.sm} color={colors.onSurfaceSecondary}>
              Drivers you've hired through RigRent. Each active seat is billed ${driverSeatPrice.toFixed(2)}/month, regardless of this — removing a driver here only stops their billing and doesn't affect their own account or app access.
            </Txt>
            {roster.map((d) => (
              <View key={d.driver_id} style={styles.rosterRow}>
                <View style={{ flex: 1 }}>
                  <Txt weight="bold">{d.driver_name}</Txt>
                  <Txt size={type.sm} color={colors.onSurfaceSecondary}>Hired {new Date(d.hired_at).toLocaleDateString()}</Txt>
                </View>
                <Btn
                  title="Remove"
                  variant="ghost"
                  loading={removeBusy === d.driver_id}
                  onPress={() => removeDriver(d.driver_id)}
                  testID={`remove-roster-${d.driver_id}`}
                />
              </View>
            ))}
          </Card>
        )}

        {isAdmin && (
          <Card style={{ gap: spacing.md }}>
            <Display size={type.lg}>PLATFORM COMMISSION</Display>
            <Txt size={type.sm} color={colors.onSurfaceSecondary}>Rental commission is 0% — owners keep 100% of every rental. RigRent's revenue on the rental side comes from owner subscriptions instead (see Subscription Plans below).</Txt>

            <Txt size={type.sm} color={colors.onSurfaceSecondary} style={{ marginTop: spacing.sm }}>Roadside repair/tow commission — taken when a poster accepts and pays a bid.</Txt>
            <View style={styles.stepper}>
              <Pressable testID="roadside-rate-minus" onPress={() => updateRoadsideRate(-0.01)} style={styles.stepBtn}><Icon name="minus" size={22} color={colors.onSurface} /></Pressable>
              <View style={{ alignItems: "center" }}>
                <Display size={type.huge} color={colors.brand}>{Math.round(roadsideRate * 100)}%</Display>
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>Vendor keeps {Math.round((1 - roadsideRate) * 100)}%</Txt>
              </View>
              <Pressable testID="roadside-rate-plus" onPress={() => updateRoadsideRate(0.01)} style={styles.stepBtn}><Icon name="plus" size={22} color={colors.onSurface} /></Pressable>
            </View>

            <Txt size={type.sm} color={colors.onSurfaceSecondary} style={{ marginTop: spacing.sm }}>Driver placement fee — charged to the employer only when they hire someone. Posting jobs stays free.</Txt>
            <View style={styles.stepper}>
              <Pressable testID="fee-minus" onPress={() => updatePlacementFee(-5)} style={styles.stepBtn}><Icon name="minus" size={22} color={colors.onSurface} /></Pressable>
              <Display size={type.huge} color={colors.brand}>${placementFee}</Display>
              <Pressable testID="fee-plus" onPress={() => updatePlacementFee(5)} style={styles.stepBtn}><Icon name="plus" size={22} color={colors.onSurface} /></Pressable>
            </View>

            <Btn title="Review Verifications" icon="clipboard-check" variant="secondary" onPress={() => router.push("/admin")} testID="admin-review-btn" />
            <Btn title="Review Disputes" icon="scale-balance" variant="secondary" onPress={() => router.push("/admin-disputes")} testID="admin-disputes-btn" />
            <Btn
              title={reseedBusy ? "Reseeding…" : "Reseed Demo Listings"}
              icon="refresh"
              variant="ghost"
              loading={reseedBusy}
              onPress={async () => {
                setReseedBusy(true);
                try {
                  await apiFetch("/admin/reseed-listings", { method: "POST" });
                } catch {}
                finally { setReseedBusy(false); }
              }}
              testID="reseed-listings-btn"
            />
          </Card>
        )}

        {isAdmin && subTiers && (
          <Card style={{ gap: spacing.md }}>
            <Display size={type.lg}>SUBSCRIPTION PLANS</Display>
            <Txt size={type.sm} color={colors.onSurfaceSecondary}>What owners pay to list trucks/trailers. Starter and Growth are flat monthly fees up to a truck limit; Enterprise is uncapped and bills per truck instead.</Txt>
            {(["starter", "growth", "enterprise"] as const).map((key) => {
              const tier = subTiers[key];
              if (!tier) return null;
              const isEnterprise = key === "enterprise";
              return (
                <View key={key} style={styles.tierEditRow}>
                  <Txt weight="bold">{tier.name}</Txt>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label={isEnterprise ? "Price / truck ($)" : "Price / month ($)"}
                        keyboardType="decimal-pad"
                        defaultValue={String(isEnterprise ? tier.price_per_truck : tier.price)}
                        onEndEditing={(e) => saveTier(key, isEnterprise ? "price_per_truck" : "price", e.nativeEvent.text)}
                        testID={`tier-${key}-price`}
                      />
                    </View>
                    {!isEnterprise && (
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Truck limit"
                          keyboardType="number-pad"
                          defaultValue={String(tier.truck_limit)}
                          onEndEditing={(e) => saveTier(key, "truck_limit", e.nativeEvent.text)}
                          testID={`tier-${key}-limit`}
                        />
                      </View>
                    )}
                  </View>
                  {tierSaving === key ? <Txt size={type.sm} color={colors.onSurfaceSecondary}>Saving…</Txt> : null}
                </View>
              );
            })}
            <Field
              label="Driver-seat price ($/month, per hired driver)"
              keyboardType="decimal-pad"
              defaultValue={String(driverSeatPrice)}
              onEndEditing={async (e) => {
                const num = parseFloat(e.nativeEvent.text);
                if (isNaN(num)) return;
                try {
                  await apiFetch("/admin/driver-seat-price", { method: "POST", body: { driver_seat_price: num } });
                  setDriverSeatPrice(num);
                } catch {}
              }}
              testID="driver-seat-price-input"
            />
            <Txt size={type.sm} color={colors.onSurfaceSecondary}>Only applies to new driver-seat subscriptions — owners already being billed keep their existing rate.</Txt>
          </Card>
        )}

        {isVendor && (
          <Card style={{ gap: spacing.md }}>
            <Display size={type.lg}>SERVICE AREA</Display>
            <Txt size={type.sm} color={colors.onSurfaceSecondary}>Set your base location and how far you'll travel — only roadside jobs within this range will notify you.</Txt>
            <Field label="Service radius (miles)" placeholder="50" keyboardType="number-pad" value={serviceRadius} onChangeText={setServiceRadius} testID="input-service-radius" />
            <Btn
              title={serviceAreaSaved ? "Updated ✓" : "Save Service Area (uses current location)"}
              icon="crosshairs-gps"
              variant="secondary"
              onPress={saveServiceArea}
              loading={serviceAreaBusy}
              testID="save-service-area-btn"
            />
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
          <Display size={type.lg}>{t("language.title")}</Display>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {(["en", "es", "pa"] as SupportedLanguage[]).map((lang) => (
              <Pressable
                key={lang}
                testID={`profile-lang-${lang}`}
                onPress={() => setLanguage(lang)}
                style={[styles.langChip, i18n.language === lang && styles.langChipActive]}
              >
                <Txt weight="bold" color={i18n.language === lang ? colors.onBrand : colors.onSurfaceSecondary}>
                  {lang === "en" ? t("language.english") : lang === "es" ? t("language.spanish") : t("language.punjabi")}
                </Txt>
              </Pressable>
            ))}
          </View>
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
  langChip: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  langChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  header: { alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 80, height: 80, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  stepBtn: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  tierEditRow: { gap: spacing.xs, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  rosterRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
