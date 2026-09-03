import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, uploadFile } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Txt, Display, Icon, Loader, Badge, Card, Btn } from "@/src/ui";
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

  const load = useCallback(async () => {
    const data = await apiFetch<any>(`/bookings/${id}`);
    setB(data);
  }, [id]);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));

  if (loading || !b) return <Loader />;
  const isOwner = user?.id === b.owner_id;

  const uploadInspection = async (phase: "before" | "after") => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploading(phase);
    try {
      const path = await uploadFile(a.uri, a.fileName || `${phase}.mp4`, a.mimeType || "video/mp4");
      await apiFetch(`/bookings/${id}/inspection`, { method: "POST", body: { phase, video_path: path } });
      await load();
    } catch {}
    finally { setUploading(null); }
  };

  const setStatus = async (status: string) => {
    await apiFetch(`/bookings/${id}/status`, { method: "POST", body: { status } });
    await load();
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
          <Row label="Dates" value={`${b.start_date} – ${b.end_date} (${b.days} days)`} />
          <Row label="Load" value={b.load_type + (b.load_weight ? ` · ${b.load_weight}` : "")} />
          {b.notes ? <Row label="Notes" value={b.notes} /> : null}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Icon name="chart-donut" size={18} color={colors.brand} />
            <Display size={type.lg}>PAYMENT SPLIT</Display>
          </View>
          <Row label="Subtotal" value={`$${b.subtotal}`} />
          <Row label={`Owner earnings (${Math.round((1 - b.commission_rate) * 100)}%)`} value={`$${b.owner_earnings}`} tone={colors.success} />
          <Row label={`RigRent fee (${Math.round(b.commission_rate * 100)}%)`} value={`$${b.app_cut}`} tone={colors.brand} />
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

        {isOwner && b.status === "pending" && (
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Btn title="Decline" variant="ghost" onPress={() => setStatus("declined")} style={{ flex: 1 }} testID="decline-btn" />
            <Btn title="Approve" onPress={() => setStatus("approved")} style={{ flex: 1 }} testID="approve-btn" />
          </View>
        )}
        {b.status === "approved" && (
          <Btn title={isOwner ? "Mark Completed" : "Start Trip"} onPress={() => setStatus(isOwner ? "completed" : "active")} testID="progress-btn" />
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
