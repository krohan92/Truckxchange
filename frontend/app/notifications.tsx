import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/api/client";
import { Txt, Display, Icon, Loader, EmptyState } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const ICONS: Record<string, string> = {
  booking_requested: "calendar-clock",
  booking_approved: "check-circle",
  booking_declined: "close-circle",
  trip_started: "truck-fast",
  trip_completed: "flag-checkered",
  bid_received: "gavel",
  bid_accepted: "trophy",
};

const TONE: Record<string, string> = {
  booking_approved: colors.success,
  trip_completed: colors.success,
  bid_accepted: colors.success,
  booking_declined: colors.error,
};

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await apiFetch<any[]>("/notifications");
    setItems(data);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));

  const open = async (n: any) => {
    if (!n.read) { apiFetch(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => {}); }
    if (n.data?.booking_id) router.push(`/booking/${n.data.booking_id}`);
    else if (n.data?.request_id) router.push(`/request/${n.data.request_id}`);
  };

  const markAll = async () => {
    await apiFetch("/notifications/read-all", { method: "POST" });
    await load();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}><Icon name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <Display size={type.xl}>ALERTS</Display>
        <Pressable testID="mark-all-btn" onPress={markAll} hitSlop={8}><Txt size={type.sm} color={colors.brand} weight="bold">Mark all</Txt></Pressable>
      </View>
      {loading ? <Loader /> : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: insets.bottom + spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}
          ListEmptyComponent={<EmptyState icon="bell-off-outline" title="No alerts yet" subtitle="Booking updates, pickups and bids will show up here" />}
          renderItem={({ item }) => (
            <Pressable testID={`notif-${item.id}`} onPress={() => open(item)} style={[styles.row, !item.read && styles.unread]}>
              <View style={[styles.iconWrap, { backgroundColor: (TONE[item.type] || colors.brand) + "22" }]}>
                <Icon name={ICONS[item.type] || "bell"} size={22} color={TONE[item.type] || colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Txt weight="bold" style={{ flex: 1 }} numberOfLines={1}>{item.title}</Txt>
                  <Txt size={type.sm} color={colors.onSurfaceSecondary}>{timeAgo(item.created_at)}</Txt>
                </View>
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>{item.body}</Txt>
              </View>
              {!item.read ? <View style={styles.dot} /> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  unread: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  iconWrap: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
});
