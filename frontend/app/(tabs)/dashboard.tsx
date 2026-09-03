import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { apiFetch } from "@/src/api/client";
import { Txt, Display, Icon, Loader, EmptyState, Badge, Btn, Card } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const STATUS_TONE: any = { pending: "warning", approved: "success", active: "brand", completed: "muted", declined: "error", cancelled: "error" };

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await apiFetch<any[]>("/bookings/incoming");
    setItems(data);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));

  const setStatus = async (id: string, status: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await apiFetch(`/bookings/${id}/status`, { method: "POST", body: { status } });
    await load();
  };

  const earnings = items.filter((b) => ["approved", "active", "completed"].includes(b.status)).reduce((s, b) => s + b.owner_earnings, 0);
  const pending = items.filter((b) => b.status === "pending").length;
  const active = items.filter((b) => ["approved", "active"].includes(b.status)).length;

  if (loading) return <Loader />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Txt size={type.sm} color={colors.onSurfaceSecondary}>Fleet command</Txt>
        <Display size={type.xxl}>OWNER DASHBOARD</Display>
      </View>

      <View style={styles.metrics}>
        <Metric label="Earnings" value={`$${earnings.toFixed(0)}`} icon="cash-multiple" big />
        <View style={{ flex: 1, gap: spacing.md }}>
          <Metric label="Active" value={String(active)} icon="truck-fast" />
          <Metric label="Pending" value={String(pending)} icon="clock-outline" />
        </View>
      </View>

      <View style={styles.section}>
        <Display size={type.lg}>INCOMING BOOKINGS</Display>
      </View>

      {items.length === 0 ? (
        <EmptyState icon="key-variant" title="No bookings yet" subtitle="List a rig so truckers can book it" action={<Btn title="Add a Rig" icon="plus" onPress={() => router.push("/create-listing")} />} />
      ) : (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {items.map((b) => (
            <Card key={b.id} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Display size={type.lg} numberOfLines={1} style={{ flex: 1 }}>{b.listing_title}</Display>
                <Badge label={b.status} tone={STATUS_TONE[b.status]} />
              </View>
              <Txt size={type.sm} color={colors.onSurfaceSecondary}>{b.renter_name} · {b.load_type}</Txt>
              <Txt size={type.sm} color={colors.onSurfaceSecondary}>{b.pickup} → {b.dropoff} · {b.days} days</Txt>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>You earn</Txt>
                <Display size={type.lg} color={colors.success}>${b.owner_earnings}</Display>
              </View>
              {b.status === "pending" && (
                <View style={{ flexDirection: "row", gap: spacing.md, marginTop: 4 }}>
                  <Btn title="Decline" variant="ghost" onPress={() => setStatus(b.id, "declined")} style={{ flex: 1, height: 44 }} testID={`decline-${b.id}`} />
                  <Btn title="Approve" onPress={() => setStatus(b.id, "approved")} style={{ flex: 1, height: 44 }} testID={`approve-${b.id}`} />
                </View>
              )}
              <Pressable onPress={() => router.push(`/booking/${b.id}`)} style={{ paddingTop: spacing.sm }}>
                <Txt size={type.sm} color={colors.brand} weight="bold">View details →</Txt>
              </Pressable>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Metric({ label, value, icon, big }: { label: string; value: string; icon: string; big?: boolean }) {
  return (
    <View style={[styles.metric, big && { flex: 1, minHeight: 116, justifyContent: "space-between" }]}>
      <Icon name={icon} size={big ? 26 : 20} color={colors.brand} />
      <View>
        <Display size={big ? type.huge : type.xl}>{value}</Display>
        <Txt size={type.sm} color={colors.onSurfaceSecondary}>{label}</Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  metrics: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg },
  metric: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm },
});
