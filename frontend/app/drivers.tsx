import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { apiFetch } from "@/src/api/client";
import { Txt, Display, Icon, Loader, EmptyState, Badge, Chip } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";
import DriverMap, { MapDriver } from "@/src/components/DriverMap";

const CDL_FILTERS = ["All", "A", "B", "C"];

function timeAgo(iso?: string) {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function BrowseDrivers() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cdlFilter, setCdlFilter] = useState("All");
  const [nearMe, setNearMe] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const load = useCallback(async (filter: string, loc: { latitude: number; longitude: number } | null) => {
    const params = new URLSearchParams();
    if (filter !== "All") params.set("cdl_class", filter);
    if (loc) { params.set("lat", String(loc.latitude)); params.set("lng", String(loc.longitude)); }
    const qs = params.toString();
    const data = await apiFetch<any[]>(`/drivers${qs ? `?${qs}` : ""}`);
    setItems(data);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(cdlFilter, nearMe ? coords : null).finally(() => setLoading(false)); }, [load, cdlFilter, nearMe, coords]));

  const toggleNearMe = async () => {
    if (nearMe) { setNearMe(false); return; }
    setLocBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setNearMe(true);
    } catch {}
    finally { setLocBusy(false); }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}><Icon name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <Display size={type.xl}>FIND DRIVERS</Display>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
        {CDL_FILTERS.map((c) => (
          <Chip key={c} label={c === "All" ? "All CDL" : `Class ${c}`} active={cdlFilter === c} onPress={() => setCdlFilter(c)} testID={`cdl-filter-${c}`} />
        ))}
        <Chip label={locBusy ? "Locating…" : "Near Me"} active={nearMe} onPress={toggleNearMe} testID="near-me-toggle" />
        {nearMe && coords ? <Chip label={showMap ? "List" : "Map"} active={showMap} onPress={() => setShowMap((v) => !v)} testID="map-toggle" /> : null}
      </View>
      {nearMe && coords && showMap ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <DriverMap
            center={coords}
            drivers={items
              .filter((i) => i.driver_profile?.last_location?.coordinates)
              .map((i): MapDriver => ({
                id: i.id,
                name: i.name,
                longitude: i.driver_profile.last_location.coordinates[0],
                latitude: i.driver_profile.last_location.coordinates[1],
                distance_mi: i.distance_mi,
              }))}
            onPressDriver={(id) => router.push(`/driver/${id}`)}
          />
        </View>
      ) : null}
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
                  {p.years_experience != null ? <Txt size={type.sm} color={colors.onSurfaceSecondary}>{p.years_experience} yrs experience{p.home_state ? ` · ${p.home_state}` : ""}</Txt> : null}
                  {(p.equipment_experience || []).length > 0 ? (
                    <Txt size={type.sm} color={colors.onSurfaceSecondary} numberOfLines={1}>{p.equipment_experience.slice(0, 3).join(", ")}</Txt>
                  ) : null}
                  {item.distance_mi != null || p.last_location_at ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Icon name="map-marker" size={13} color={colors.onSurfaceSecondary} />
                      <Txt size={type.sm} color={colors.onSurfaceSecondary}>
                        {item.distance_mi != null ? `${item.distance_mi} mi away` : null}
                        {item.distance_mi != null && p.last_location_at ? " · " : null}
                        {p.last_location_at ? `seen ${timeAgo(p.last_location_at)}` : null}
                      </Txt>
                    </View>
                  ) : null}
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
