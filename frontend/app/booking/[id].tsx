import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, uploadFile } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Txt, Display, Icon, Loader, Badge, Card, Btn, Field, Chip } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const STATUS_TONE: any = { pending: "warning", approved: "success", active: "brand", completed: "muted", declined: "error", cancelled: "error" };

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [b, setB] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState("");

  const load = useCallback(async () => {
    const data = await apiFetch<any>(`/bookings/${id}`);
    setB(data);
  }, [id]);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));

  if (loading || !b) return <Loader />;
  const isOwner = user?.id === b.owner_id;

  const [beforeOdo, setBeforeOdo] = useState("");
  const [afterOdo, setAfterOdo] = useState("");
  const [beforeFuel, setBeforeFuel] = useState<string | null>(null);
  const [afterFuel, setAfterFuel] = useState<string | null>(null);

  const uploadInspection = async (phase: "before" | "after") => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploading(phase);
    try {
      const path = await uploadFile(a.uri, a.fileName || `${phase}.mp4`, a.mimeType || "video/mp4");
      const odometer = phase === "before" ? beforeOdo : afterOdo;
      const fuel_level = phase === "before" ? beforeFuel : afterFuel;
      await apiFetch(`/bookings/${id}/inspection`, {
        method: "POST",
        body: { phase, video_path: path, odometer: odometer ? parseInt(odometer, 10) : null, fuel_level },
      });
      await load();
    } catch {}
    finally { setUploading(null); }
  };

  const setStatus = async (status: string) => {
    await apiFetch(`/bookings/${id}/status`, { method: "POST", body: { status } });
    await load();
  };

  const payNow = async () => {
    setPayError("");
    setPayBusy(true);
    try {
      const res = await apiFetch<{ checkout_url: string }>(`/bookings/${id}/pay`, { method: "POST" });
      await Linking.openURL(res.checkout_url);
    } catch (e: any) {
      setPayError(e.message || "Could not start checkout");
    } finally {
      setPayBusy(false);
    }
  };

  const submitReview = async () => {
    setReviewBusy(true);
    try {
      await apiFetch(`/bookings/${id}/review`, { method: "POST", body: { rating: stars, comment } });
      await load();
    } catch {}
    finally { setReviewBusy(false); }
  };

  const hasPhase = (p: string) => b.inspections?.some((i: any) => i.phase === p);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}><Icon name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <Display size={type.xl}>BOOKING</Display>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Display size={type.huge} style={{ flex: 1 }}>{b.listing_title}</Display>
          <Badge label={b.status} tone={STATUS_TONE[b.status]} />
        </View>

        <Card style={{ gap: spacing.sm }}>
          <Row label="Route" value={`${b.pickup} → ${b.dropoff}`} />
          <Row label="Distance" value={`~${(b.estimated_miles || 0).toLocaleString()} mi`} />
          {b.start_date && b.start_date !== "TBD" ? <Row label="Dates" value={`${b.start_date} – ${b.end_date}`} /> : null}
          <Row label="Load" value={b.load_type + (b.load_weight ? ` · ${b.load_weight}` : "")} />
          <Row label="Rig return" value={b.return_same_location ? "Same pickup location" : (b.return_location_note || "Different location (see notes)")} tone={b.return_same_location ? undefined : colors.warning} />
          {b.notes ? <Row label="Notes" value={b.notes} /> : null}
        </Card>

        {b.pickup_address ? (
          <Card style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Icon name="map-marker-radius" size={18} color={colors.brand} />
              <Display size={type.lg}>PICKUP DETAILS</Display>
            </View>
            <Row label="Address" value={b.pickup_address} />
            {b.pickup_instructions ? <Row label="Instructions" value={b.pickup_instructions} /> : null}
            {b.access_code ? <Row label="Access code" value={b.access_code} tone={colors.brand} /> : null}
          </Card>
        ) : !isOwner && b.status === "pending" ? (
          <Card style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Icon name="lock-outline" size={18} color={colors.onSurfaceSecondary} />
              <Txt color={colors.onSurfaceSecondary}>Pickup address is revealed once the owner approves this booking.</Txt>
            </View>
          </Card>
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Icon name="cash" size={18} color={colors.brand} />
            <Display size={type.lg}>{isOwner ? "YOUR PAYOUT" : "TRIP COST"}</Display>
          </View>
          <Row label={`${(b.estimated_miles || 0).toLocaleString()} mi × $${(b.price_per_mile || 0).toFixed(2)}/mi`} value={`$${b.subtotal}`} />
          {isOwner ? (
            <Row label="You earn" value={`$${b.owner_earnings}`} tone={colors.success} />
          ) : (
            <Row label="Estimated total" value={`$${b.subtotal}`} tone={colors.brand} />
          )}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Icon name="video-outline" size={18} color={colors.brand} />
            <Display size={type.lg}>INSPECTION VIDEOS</Display>
          </View>
          <Txt size={type.sm} color={colors.onSurfaceSecondary}>Record a walkaround before pickup and after return to document condition.</Txt>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            {(["before", "after"] as const).map((p) => (
              <View key={p} style={styles.videoTile}>
                <Icon name={hasPhase(p) ? "check-circle" : "video-plus"} size={28} color={hasPhase(p) ? colors.success : colors.onSurfaceSecondary} />
                <Txt weight="bold" style={{ textTransform: "capitalize" }}>{p}</Txt>
                {!hasPhase(p) && (
                  <>
                    <Field
                      placeholder="Odometer (mi)"
                      keyboardType="number-pad"
                      value={p === "before" ? beforeOdo : afterOdo}
                      onChangeText={p === "before" ? setBeforeOdo : setAfterOdo}
                      style={{ width: 130 }}
                      testID={`odometer-${p}`}
                    />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
                      {["full", "3/4", "1/2", "1/4", "empty"].map((f) => (
                        <Chip
                          key={f}
                          label={f}
                          active={(p === "before" ? beforeFuel : afterFuel) === f}
                          onPress={() => (p === "before" ? setBeforeFuel(f) : setAfterFuel(f))}
                        />
                      ))}
                    </View>
                  </>
                )}
                <Btn
                  title={hasPhase(p) ? "Replace" : "Upload"}
                  variant="secondary"
                  onPress={() => uploadInspection(p)}
                  loading={uploading === p}
                  style={{ height: 40 }}
                  testID={`upload-${p}`}
                />
              </View>
            ))}
          </View>
        </Card>

        {!isOwner && b.status === "completed" && (
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Icon name="star-outline" size={18} color={colors.brand} />
              <Display size={type.lg}>RATE THIS RIG</Display>
            </View>
            {b.reviewed ? (
              <Txt color={colors.success} weight="bold">Thanks — your review has been submitted.</Txt>
            ) : (
              <>
                <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "center" }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Pressable key={s} testID={`star-${s}`} onPress={() => setStars(s)} hitSlop={6}>
                      <Icon name={s <= stars ? "star" : "star-outline"} size={34} color={colors.warning} />
                    </Pressable>
                  ))}
                </View>
                <Field label="Comment (optional)" placeholder="How was the truck & the owner?" value={comment} onChangeText={setComment} multiline testID="review-comment" />
                <Btn title="Submit Review" icon="send" onPress={submitReview} loading={reviewBusy} testID="submit-review-btn" />
              </>
            )}
          </Card>
        )}

        {isOwner && b.status === "pending" && (
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Btn title="Decline" variant="ghost" onPress={() => setStatus("declined")} style={{ flex: 1 }} testID="decline-btn" />
            <Btn title="Approve" onPress={() => setStatus("approved")} style={{ flex: 1 }} testID="approve-btn" />
          </View>
        )}
        {b.status === "active" && isOwner && (
          <View style={{ gap: spacing.sm }}>
            <Btn title="Mark Completed" onPress={() => setStatus("completed")} disabled={!hasPhase("after")} testID="progress-btn" />
            {!hasPhase("after") ? <Txt size={type.sm} color={colors.onSurfaceSecondary}>Upload the "after" inspection above before completing the trip.</Txt> : null}
          </View>
        )}
        {b.status === "approved" && !isOwner && (
          <View style={{ gap: spacing.sm }}>
            <Btn title="Pay Now" icon="credit-card" onPress={payNow} loading={payBusy} testID="pay-now-btn" />
            {payError ? <Txt color={colors.error} size={type.sm}>{payError}</Txt> : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md, alignItems: "center" }}>
      <Txt size={type.sm} color={colors.onSurfaceSecondary} style={{ flex: 1 }}>{label}</Txt>
      <Display size={type.lg} color={tone || colors.onSurface} style={{ flex: 1.4, textAlign: "right" }}>{value}</Display>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  videoTile: { flex: 1, alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md },
});
