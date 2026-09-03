import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Txt, Display, Icon, Loader, EmptyState, Badge, Btn } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const CAT_ICON: any = { tow: "tow-truck", repair: "wrench", maintenance: "oil" };
const STATUS_TONE: any = { open: "warning", awarded: "success" };

export default function Roadside() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const isVendor = user?.role === "vendor";
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await apiFetch<any[]>("/requests");
    setItems(data);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View>
          <Txt size={type.sm} color={colors.onSurfaceSecondary}>{isVendor ? "Win the job" : "Tow & repair"}</Txt>
          <Display size={type.xxl}>{isVendor ? "OPEN JOBS" : "ROADSIDE"}</Display>
        </View>
        {!isVendor && (
          <Pressable testID="add-request-btn" onPress={() => router.push("/create-request")} style={styles.addBtn}>
            <Icon name="plus" size={24} color={colors.onBrand} />
          </Pressable>
        )}
      </View>
      {loading ? <Loader /> : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand} />}
          ListEmptyComponent={
            <EmptyState
              icon="wrench"
              title={isVendor ? "No open requests" : "No active requests"}
              subtitle={isVendor ? "Check back soon for tow & repair jobs to bid on" : "Post a breakdown and let companies bid to help"}
              action={!isVendor ? <Btn title="Post a Request" icon="plus" onPress={() => router.push("/create-request")} /> : undefined}
            />
          }
          renderItem={({ item }) => (
            <Pressable testID={`request-${item.id}`} onPress={() => router.push(`/request/${item.id}`)} style={styles.row}>
              <View style={styles.catIcon}>
                <Icon name={CAT_ICON[item.category]} size={24} color={colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Display size={type.lg} numberOfLines={1}>{item.title}</Display>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Icon name="map-marker" size={13} color={colors.onSurfaceSecondary} />
                  <Txt size={type.sm} color={colors.onSurfaceSecondary} numberOfLines={1}>{item.location}</Txt>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                  <Badge label={item.status} tone={STATUS_TONE[item.status] || "muted"} />
                  <Txt size={type.sm} color={colors.onSurfaceSecondary}>{item.bid_count} bid{item.bid_count === 1 ? "" : "s"}</Txt>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  addBtn: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  catIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
});
