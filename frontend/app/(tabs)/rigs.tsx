import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { apiFetch, fileUrl } from "@/src/api/client";
import { Txt, Display, Icon, Loader, EmptyState, Badge, Btn } from "@/src/ui";
import NotificationBell from "@/src/components/NotificationBell";
import { colors, spacing, radius, type } from "@/src/theme";

export default function Rigs() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await apiFetch<any[]>("/listings/mine");
    setItems(data);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));

  const remove = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await apiFetch(`/listings/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View>
          <Txt size={type.sm} color={colors.onSurfaceSecondary}>Your fleet</Txt>
          <Display size={type.xxl}>MY RIGS</Display>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <NotificationBell />
          <Pressable testID="add-rig-btn" onPress={() => router.push("/create-listing")} style={styles.addBtn}>
            <Icon name="plus" size={24} color={colors.onBrand} />
          </Pressable>
        </View>
      </View>
      {loading ? <Loader /> : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}
          ListEmptyComponent={<EmptyState icon="truck-outline" title="List your first rig" subtitle="Add a truck or trailer and start earning" action={<Btn title="Add a Rig" icon="plus" onPress={() => router.push("/create-listing")} />} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Image source={{ uri: fileUrl(item.photos?.[0] || "") }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1, gap: 4 }}>
                <Display size={type.lg} numberOfLines={1}>{item.title}</Display>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Badge label={item.category} tone="brand" />
                  <Badge label={`$${item.daily_rate}/day`} tone="muted" />
                </View>
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>{item.location}</Txt>
              </View>
              <Pressable testID={`delete-rig-${item.id}`} onPress={() => remove(item.id)} style={styles.trashBtn}>
                <Icon name="trash-can-outline" size={20} color={colors.error} />
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  addBtn: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  trashBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
});
