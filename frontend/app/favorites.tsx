import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, fileUrl } from "@/src/api/client";
import { Txt, Display, Icon, Loader, Badge } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

type Listing = {
  id: string; title: string; kind: string; category: string; location: string;
  price_per_mile: number; mileage?: number; photos: string[];
};

export default function Favorites() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Listing[] | null>(null);

  useFocusEffect(useCallback(() => {
    apiFetch<Listing[]>("/favorites").then(setItems).catch(() => setItems([]));
  }, []));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Display size={type.xl}>FAVORITES</Display>
        <View style={{ width: 40 }} />
      </View>

      {items === null ? (
        <Loader />
      ) : items.length === 0 ? (
        <View style={{ alignItems: "center", padding: spacing.xxl }}>
          <Icon name="heart-outline" size={36} color={colors.onSurfaceSecondary} />
          <Txt color={colors.onSurfaceSecondary} style={{ marginTop: spacing.sm }}>No favorites yet.</Txt>
          <Txt color={colors.onSurfaceSecondary} size={type.sm} style={{ marginTop: 4 }}>Tap the heart on any listing to save it here.</Txt>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
          renderItem={({ item }) => (
            <Pressable testID={`fav-listing-${item.id}`} onPress={() => router.push(`/listing/${item.id}`)} style={styles.row}>
              <Image source={{ uri: fileUrl(item.photos?.[0] || "") }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1, gap: 4 }}>
                <Txt weight="bold" numberOfLines={1}>{item.title}</Txt>
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>
                  {item.mileage != null ? `${item.mileage.toLocaleString()} mi · ` : ""}{item.location}
                </Txt>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                  <Display size={type.lg} color={colors.brand}>${item.price_per_mile?.toFixed(2)}</Display>
                  <Txt size={type.sm} color={colors.onSurfaceSecondary}>/mi</Txt>
                </View>
              </View>
              <Badge label={item.category} tone="brand" />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
});
