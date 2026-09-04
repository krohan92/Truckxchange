import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, ScrollView, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter, useFocusEffect, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, fileUrl } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Txt, Display, Field, Chip, Icon, Loader, EmptyState, Badge } from "@/src/ui";
import NotificationBell from "@/src/components/NotificationBell";
import { colors, spacing, radius, fonts, type } from "@/src/theme";

const CATS = ["All", "Semi", "Box", "Flatbed Truck", "Dump Truck", "Flatbed", "Reefer", "Dry Van", "Lowboy"];
const SORTS: { key: string; label: string; icon: string }[] = [
  { key: "newest", label: "Newest", icon: "clock-outline" },
  { key: "near_me", label: "Near Me", icon: "crosshairs-gps" },
  { key: "price_low", label: "Price: Low to High", icon: "sort-ascending" },
  { key: "price_high", label: "Price: High to Low", icon: "sort-descending" },
  { key: "rating", label: "Top Rated", icon: "star-outline" },
];

type Listing = {
  id: string; title: string; kind: string; category: string; location: string;
  price_per_mile: number; year?: number; make?: string; capacity?: string; photos: string[];
  rating?: number; rating_count?: number; distance_mi?: number;
};

export default function Market() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState("newest");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [locError, setLocError] = useState("");

  const load = useCallback(async (category: string, query: string, sortKey: string) => {
    const params = new URLSearchParams();
    if (category !== "All") params.set("category", category);
    if (query) params.set("q", query);

    if (sortKey === "near_me") {
      setLocError("");
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocError("Location permission denied — showing newest listings instead.");
        } else {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          params.set("lat", String(pos.coords.latitude));
          params.set("lng", String(pos.coords.longitude));
        }
      } catch {
        setLocError("Couldn't get your location — showing newest listings instead.");
      }
    } else if (sortKey !== "newest") {
      params.set("sort", sortKey);
    }

    const data = await apiFetch<Listing[]>(`/listings?${params.toString()}`, { auth: false });
    setItems(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load(cat, q, sort).finally(() => setLoading(false));
    }, [cat, q, sort, load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(cat, q, sort);
    setRefreshing(false);
  };

  if (user?.role === "owner") return <Redirect href="/(tabs)/dashboard" />;
  if (user?.role === "vendor") return <Redirect href="/(tabs)/roadside" />;

  const renderCard = ({ item }: { item: Listing }) => (
    <Pressable testID={`listing-${item.id}`} onPress={() => router.push(`/listing/${item.id}`)} style={styles.card}>
      <Image source={{ uri: fileUrl(item.photos?.[0] || "") }} style={styles.cardImg} contentFit="cover" transition={200} />
      <LinearGradient colors={["transparent", colors.scrim]} style={styles.cardScrim} />
      <View style={styles.cardTopRow}>
        <Badge label={item.kind} tone="muted" />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {item.rating_count ? (
            <View style={styles.ratingPill}>
              <Icon name="star" size={12} color={colors.warning} />
              <Txt size={type.sm} weight="bold">{item.rating?.toFixed(1)}</Txt>
            </View>
          ) : null}
          <Badge label={item.category} tone="brand" />
        </View>
      </View>
      <View style={styles.cardBottom}>
        <Display size={type.xl} numberOfLines={1} color={colors.onScrim}>{item.title}</Display>
        <View style={styles.metaRow}>
          <Icon name="map-marker" size={14} color={colors.onScrimSecondary} />
          <Txt size={type.sm} color={colors.onScrimSecondary}>{item.distance_mi != null ? `${item.distance_mi} mi away` : item.location}</Txt>
          {item.capacity ? (
            <>
              <Icon name="weight" size={14} color={colors.onScrimSecondary} style={{ marginLeft: spacing.sm }} />
              <Txt size={type.sm} color={colors.onScrimSecondary}>{item.capacity}</Txt>
            </>
          ) : null}
        </View>
        <View style={styles.priceTag}>
          <Text2 rate={item.price_per_mile} />
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTop}>
          <View>
            <Txt size={type.sm} color={colors.onSurfaceSecondary}>Find your next</Txt>
            <Display size={type.xxl}>RIG MARKETPLACE</Display>
          </View>
          <NotificationBell />
        </View>
        <Field placeholder="Search trucks & trailers" value={q} onChangeText={setQ} returnKeyType="search" onSubmitEditing={() => load(cat, q, sort)} testID="search-input" />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRow}
            contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: 2 }}
          >
            {CATS.map((c) => (
              <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} testID={`chip-${c}`} />
            ))}
          </ScrollView>
        </View>
        <Pressable testID="sort-toggle" onPress={() => setSortOpen((v) => !v)} style={styles.sortRow}>
          <Icon name={SORTS.find((s) => s.key === sort)?.icon || "sort"} size={16} color={colors.brand} />
          <Txt size={type.sm} weight="bold" color={colors.brand}>{SORTS.find((s) => s.key === sort)?.label}</Txt>
          <Icon name={sortOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.brand} />
        </Pressable>
        {locError ? <Txt size={type.sm} color={colors.error}>{locError}</Txt> : null}
        {sortOpen && (
          <View style={styles.sortMenu}>
            {SORTS.map((s) => (
              <Pressable
                key={s.key}
                testID={`sort-${s.key}`}
                onPress={() => { setSort(s.key); setSortOpen(false); }}
                style={styles.sortOption}
              >
                <Icon name={s.icon} size={16} color={sort === s.key ? colors.brand : colors.onSurfaceSecondary} />
                <Txt color={sort === s.key ? colors.onSurface : colors.onSurfaceSecondary} weight={sort === s.key ? "bold" : "regular"}>{s.label}</Txt>
                {sort === s.key ? <Icon name="check" size={16} color={colors.brand} style={{ marginLeft: "auto" }} /> : null}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderCard}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          ListEmptyComponent={<EmptyState icon="garage" title="No rigs available" subtitle="Try clearing your filters or search" />}
        />
      )}
    </View>
  );
}

function Text2({ rate }: { rate: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
      <Display size={type.xl} color={colors.brand}>${rate?.toFixed(2)}</Display>
      <Txt size={type.sm} color={colors.onScrimSecondary}>/mi</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chipRow: { marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg },
  sortRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  sortMenu: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  sortOption: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  card: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary, height: 240 },
  cardImg: { ...StyleSheet.absoluteFillObject },
  cardScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", padding: spacing.md },
  cardBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, gap: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  priceTag: {
    position: "absolute", right: spacing.lg, bottom: spacing.lg,
    backgroundColor: colors.scrim, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.borderStrong,
  },
  ratingPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.scrim, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
});
