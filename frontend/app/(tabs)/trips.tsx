import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, fileUrl } from "@/src/api/client";
import { Txt, Display, Icon, Loader, EmptyState, Badge } from "@/src/ui";
import NotificationBell from "@/src/components/NotificationBell";
import { colors, spacing, radius, type } from "@/src/theme";

const STATUS_TONE: any = { pending: "warning", approved: "success", active: "brand", completed: "muted", declined: "error", cancelled: "error" };

export default function Trips() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await apiFetch<any[]>("/bookings/mine");
    setItems(data);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }]}>
        <View>
          <Txt size={type.sm} color={colors.onSurfaceSecondary}>Your bookings</Txt>
          <Display size={type.xxl}>MY TRIPS</Display>
        </View>
        <NotificationBell />
      </View>
      {loading ? <Loader /> : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}
          ListEmptyComponent={<EmptyState icon="road-variant" title="No trips yet" subtitle="Book a rig from the marketplace to get rolling" />}
          renderItem={({ item }) => (
            <Pressable testID={`trip-${item.id}`} onPress={() => router.push(`/booking/${item.id}`)} style={styles.row}>
              <Image source={{ uri: fileUrl(item.listing_photo || "") }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1, gap: 4 }}>
                <Display size={type.lg} numberOfLines={1}>{item.listing_title}</Display>
                <Txt size={type.sm} color={colors.onSurfaceSecondary} numberOfLines={1}>{item.pickup} → {item.dropoff}</Txt>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Badge label={item.status} tone={STATUS_TONE[item.status]} />
                  <Txt size={type.sm} color={colors.onSurfaceSecondary}>{item.days} days · ${item.subtotal}</Txt>
                </View>
              </View>
              <Icon name="chevron-right" size={22} color={colors.onSurfaceSecondary} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
});
