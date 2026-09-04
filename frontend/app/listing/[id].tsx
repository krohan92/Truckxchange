import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Dimensions, Modal } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, fileUrl } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Txt, Display, Field, Btn, Icon, Loader, Badge, Card, Chip } from "@/src/ui";
import { colors, spacing, radius, fonts, type } from "@/src/theme";

const { width } = Dimensions.get("window");

const POLICY_INFO: Record<string, { label: string; description: string }> = {
  flexible: { label: "Flexible", description: "Full refund if cancelled 24+ hours before pickup." },
  moderate: { label: "Moderate", description: "Full refund 5+ days before, 50% 1-5 days before, no refund inside 24 hours." },
  strict: { label: "Strict", description: "Full refund 14+ days before, 50% 7-14 days before, no refund inside 7 days." },
};

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imgIdx, setImgIdx] = useState(0);
  const [confirmed, setConfirmed] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);

  const [miles, setMiles] = useState("250");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loadType, setLoadType] = useState("");
  const [loadWeight, setLoadWeight] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [notes, setNotes] = useState("");
  const [returnSameLocation, setReturnSameLocation] = useState(true);
  const [returnLocationNote, setReturnLocationNote] = useState("");

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([
        apiFetch(`/listings/${id}`, { auth: false }),
        apiFetch(`/listings/${id}/reviews`, { auth: false }),
      ])
        .then(([l, r]: any) => {
          setListing(l);
          setReviews(r);
        })
        .finally(() => setLoading(false));
    }, [id])
  );

  if (loading) return <Loader />;
  if (!listing) return null;

  const nMiles = Math.max(1, parseInt(miles || "1", 10) || 1);
  const ppm = listing.price_per_mile || 0;
  const subtotal = +(ppm * nMiles).toFixed(2);

  const needsVerify = user?.role === "renter" && !user?.license_verified;
  const insExpired = (() => {
    if (!listing.insurance_expiry) return null;
    const d = new Date(listing.insurance_expiry);
    return isFinite(d.getTime()) ? d < new Date() : null;
  })();

  const book = async () => {
    if (needsVerify) {
      router.push("/verify");
      return;
    }
    setError("");
    if (!loadType.trim() || !pickup.trim() || !dropoff.trim()) {
      setError("Please fill load type, pickup and dropoff");
      return;
    }
    setBusy(true);
    try {
      const b = await apiFetch<any>("/bookings", {
        method: "POST",
        body: {
          listing_id: listing.id,
          estimated_miles: nMiles,
          start_date: startDate || "TBD",
          end_date: endDate || "TBD",
          load_type: loadType,
          load_weight: loadWeight,
          pickup,
          dropoff,
          return_same_location: returnSameLocation,
          return_location_note: returnSameLocation ? "" : returnLocationNote,
          notes,
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setConfirmed(b);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const isOwner = user?.role === "owner";

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView bottomOffset={90} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setImgIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {(listing.photos?.length ? listing.photos : [""]).map((p: string, i: number) => (
              <Image key={i} source={{ uri: fileUrl(p) }} style={{ width, height: 300 }} contentFit="cover" transition={200} />
            ))}
          </ScrollView>
          <LinearGradient colors={[colors.scrim, "transparent", colors.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <Pressable testID="back-btn" onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + spacing.sm }]}>
            <Icon name="chevron-left" size={26} color={colors.onScrim} />
          </Pressable>
          {listing.photos?.length > 1 ? (
            <View style={styles.dots}>
              {listing.photos.map((_: string, i: number) => (
                <View key={i} style={[styles.dot, i === imgIdx && styles.dotActive]} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Badge label={listing.kind} tone="muted" />
            <Badge label={listing.category} tone="brand" />
          </View>
          <Display size={type.huge}>{listing.title}</Display>
          <View style={styles.metaRow}>
            <Icon name="map-marker" size={16} color={colors.onSurfaceSecondary} />
            <Txt color={colors.onSurfaceSecondary}>{listing.location}</Txt>
          </View>

          <View style={styles.specGrid}>
            {[
              ["calendar", "Year", listing.year || "—"],
              ["factory", "Make", listing.make || "—"],
              ["weight", "Capacity", listing.capacity || "—"],
            ].map(([ic, label, val]) => (
              <View key={label as string} style={styles.spec}>
                <Icon name={ic as string} size={18} color={colors.brand} />
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>{label as string}</Txt>
                <Display size={type.lg}>{String(val)}</Display>
              </View>
            ))}
          </View>

          {listing.description ? <Txt color={colors.onSurfaceTertiary} style={{ lineHeight: 22 }}>{listing.description}</Txt> : null}
          <Txt size={type.sm} color={colors.onSurfaceSecondary}>Owner · {listing.owner_name}</Txt>

          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md }}>
            <Icon name="calendar-remove-outline" size={18} color={colors.onSurfaceSecondary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Txt weight="bold" size={type.sm}>{POLICY_INFO[listing.cancellation_policy || "moderate"].label} cancellation</Txt>
              <Txt size={type.sm} color={colors.onSurfaceSecondary}>{POLICY_INFO[listing.cancellation_policy || "moderate"].description}</Txt>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
              <Display size={type.huge} color={colors.brand}>${ppm.toFixed(2)}</Display>
              <Txt color={colors.onSurfaceSecondary}>per mile</Txt>
            </View>
            {listing.rating_count ? (
              <View style={{ alignItems: "flex-end" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Icon name="star" size={18} color={colors.warning} />
                  <Display size={type.xl}>{listing.rating?.toFixed(1)}</Display>
                </View>
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>{listing.rating_count} review{listing.rating_count === 1 ? "" : "s"}</Txt>
              </View>
            ) : (
              <Txt size={type.sm} color={colors.onSurfaceSecondary}>No reviews yet</Txt>
            )}
          </View>

          {listing.dot_number ? (
            <Card style={{ gap: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Icon name="shield-check" size={18} color={colors.success} />
                  <Display size={type.lg}>COMPLIANCE</Display>
                </View>
                <Badge label={insExpired ? "Insurance Expired" : "Road Legal"} tone={insExpired ? "error" : "success"} />
              </View>
              <SplitRow label="DOT number" value={listing.dot_number} />
              {listing.mc_number ? <SplitRow label="MC number" value={listing.mc_number} /> : null}
              <SplitRow label="Insurance" value={listing.insurance_provider} />
              <SplitRow label="Policy #" value={listing.insurance_policy} />
              <SplitRow label="Insured through" value={listing.insurance_expiry} tone={insExpired ? "brand" : "success"} />
            </Card>
          ) : null}

          {!isOwner && (
            <>
              <Display size={type.xl} style={{ marginTop: spacing.md }}>TRIP DETAILS</Display>
              <View style={{ gap: spacing.md }}>
                <Field label="Estimated miles" placeholder="e.g. 850" keyboardType="number-pad" value={miles} onChangeText={setMiles} testID="input-miles" />
                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  <View style={{ flex: 1 }}><Field label="Start (optional)" placeholder="Jun 12" value={startDate} onChangeText={setStartDate} /></View>
                  <View style={{ flex: 1 }}><Field label="End (optional)" placeholder="Jun 15" value={endDate} onChangeText={setEndDate} /></View>
                </View>
                <Field label="Load type" placeholder="e.g. Steel coils, produce" value={loadType} onChangeText={setLoadType} testID="input-loadtype" />
                <Field label="Load weight (optional)" placeholder="e.g. 38,000 lb" value={loadWeight} onChangeText={setLoadWeight} />
                <Field label="Pickup" placeholder="Origin city" value={pickup} onChangeText={setPickup} testID="input-pickup" />
                <Field label="Dropoff" placeholder="Destination city" value={dropoff} onChangeText={setDropoff} testID="input-dropoff" />

                <Txt size={type.sm} weight="medium" color={colors.onSurfaceSecondary} style={{ marginTop: spacing.sm }}>Returning the rig itself</Txt>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Chip label="Same pickup location" active={returnSameLocation} onPress={() => setReturnSameLocation(true)} />
                  <Chip label="Different drop-off" active={!returnSameLocation} onPress={() => setReturnSameLocation(false)} />
                </View>
                {!returnSameLocation ? (
                  <Field
                    placeholder="Where will you leave it? (owner must agree)"
                    value={returnLocationNote}
                    onChangeText={setReturnLocationNote}
                    testID="input-return-location"
                  />
                ) : null}

                <Field label="Notes (optional)" placeholder="Anything the owner should know" value={notes} onChangeText={setNotes} multiline />
              </View>

              <Card style={{ gap: spacing.md, marginTop: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Icon name="calculator-variant" size={18} color={colors.brand} />
                  <Display size={type.lg}>ESTIMATED COST</Display>
                </View>
                <SplitRow label={`${nMiles.toLocaleString()} mi × $${ppm.toFixed(2)}/mi`} value={`$${subtotal.toFixed(2)}`} />
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>Final total is based on actual miles driven, logged via ELD at drop-off.</Txt>
              </Card>

              {error ? <Txt color={colors.error} size={type.sm}>{error}</Txt> : null}
            </>
          )}

          {reviews.length > 0 ? (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              <Display size={type.xl}>REVIEWS</Display>
              {reviews.map((rv) => (
                <Card key={rv.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Txt weight="bold">{rv.renter_name}</Txt>
                    <View style={{ flexDirection: "row", gap: 2 }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Icon key={s} name={s <= rv.rating ? "star" : "star-outline"} size={14} color={colors.warning} />
                      ))}
                    </View>
                  </View>
                  {rv.comment ? <Txt size={type.sm} color={colors.onSurfaceTertiary}>{rv.comment}</Txt> : null}
                </Card>
              ))}
            </View>
          ) : null}
        </View>
      </KeyboardAwareScrollView>

      {!isOwner && (
        <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
          <View style={[styles.bookBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <View>
              <Txt size={type.sm} color={colors.onSurfaceSecondary}>Total</Txt>
              <Display size={type.xxl} color={colors.brand}>${subtotal.toFixed(0)}</Display>
            </View>
            <Btn
              title={needsVerify ? "Verify License to Book" : "Book Rig"}
              icon={needsVerify ? "shield-alert" : "check-decagram"}
              onPress={book}
              loading={busy}
              style={{ flex: 1, marginLeft: spacing.lg }}
              testID="book-btn"
            />
          </View>
        </KeyboardStickyView>
      )}

      <Modal visible={!!confirmed} transparent animationType="fade" onRequestClose={() => setConfirmed(null)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <View style={styles.successCircle}>
              <Icon name="check-decagram" size={44} color={colors.success} />
            </View>
            <Display size={type.huge} style={{ textAlign: "center" }}>BOOKING REQUESTED</Display>
            <Txt color={colors.onSurfaceSecondary} style={{ textAlign: "center" }}>
              Your request for {listing.title} is on its way to the owner.
            </Txt>
            {confirmed ? (
              <View style={styles.modalSplit}>
                <SplitRow label={`${confirmed.estimated_miles?.toLocaleString?.() ?? confirmed.estimated_miles} mi × $${(confirmed.price_per_mile || 0).toFixed(2)}/mi`} value={`$${confirmed.subtotal.toFixed(2)}`} />
                <SplitRow label="Estimated total" value={`$${confirmed.subtotal.toFixed(2)}`} tone="brand" />
              </View>
            ) : null}
            <Btn title="View Booking" icon="arrow-right" onPress={() => { const id = confirmed.id; setConfirmed(null); router.replace(`/booking/${id}`); }} testID="view-booking-btn" />
            <Btn title="Back to Marketplace" variant="ghost" onPress={() => { setConfirmed(null); router.replace("/(tabs)"); }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SplitRow({ label, value, tone }: { label: string; value: string; tone?: "success" | "brand" }) {
  const c = tone === "success" ? colors.success : tone === "brand" ? colors.brand : colors.onSurface;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Txt size={type.sm} color={colors.onSurfaceSecondary} style={{ flex: 1 }}>{label}</Txt>
      <Display size={type.lg} color={c}>{value}</Display>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 300 },
  backBtn: { position: "absolute", left: spacing.lg, width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong },
  dots: { position: "absolute", bottom: spacing.xxl, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { backgroundColor: colors.brand, width: 18 },
  body: { padding: spacing.lg, gap: spacing.md, marginTop: -spacing.xxl },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  specGrid: { flexDirection: "row", gap: spacing.md },
  spec: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  splitBar: { flexDirection: "row", height: 12, borderRadius: radius.pill, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  barOwner: { backgroundColor: colors.success },
  barApp: { backgroundColor: colors.brand },
  bookBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border,
  },
  modalScrim: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modalCard: { width: "100%", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.md, alignItems: "stretch" },
  successCircle: { alignSelf: "center", width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(16,185,129,0.14)", alignItems: "center", justifyContent: "center" },
  modalSplit: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
});
