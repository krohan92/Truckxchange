import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/api/client";
import { Txt, Display, Icon, Loader, EmptyState, Badge, Chip } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const CDL_FILTERS = ["All", "A", "B", "C"];

export default function BrowseDrivers() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cdlFilter, setCdlFilter] = useState("All");

  const load = useCallback(async (filter: string) => {
    const params = filter !== "All" ? `?cdl_class=${filter}` : "";
    const data = await apiFetch<any[]>(`/drivers${params}`);
    setItems(data);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(cdlFilter).finally(() => setLoading(false)); }, [load, cdlFilter]));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}><Icon name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <Display size={type.xl}>FIND DRIVERS</Display>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: "row", gap: spacing.sm }}>
        {CDL_FILTERS.map((c) => (
          <Chip key={c} label={c === "All" ? "All CDL" : `Class ${c}`} active={cdlFilter === c} onPress={() => setCdlFilter(c)} testID={`cdl-filter-${c}`} />
        ))}
      </View>
      {loading ? <Loader /> : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl }}
          ListEmptyComponent={<EmptyState icon="account-search" title="No drivers found" subtitle="Try a different CDL class filter, or check back later" />}
          renderItem={({ item }) => {
            const p = item.driver_profile || {};
            return (
              <Pressable testID={`driver-${item.id}`} onPress={() => router.push(`/driver/${item.id}`)} style={styles.row}>
                <View style={styles.avatar}><Icon name="account" size={26} color={colors.onSurfaceSecondary} /></View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt weight="bold">{item.name}</Txt>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {p.cdl_class && p.cdl_class !== "None" ? <Badge label={`CDL ${p.cdl_class}`} tone="brand" /> : null}
                    {p.availability ? <Badge label={p.availability} tone="muted" /> : null}
                  </View>
                  {p.years_experience != null ? <Txt size={type.sm} color={colors.onSurfaceSecondary}>{p.years_experience} yrs experience{p.home_location ? ` · ${p.home_location}` : ""}</Txt> : null}
                </View>
                <Icon name="chevron-right" size={22} color={colors.onSurfaceSecondary} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
});
