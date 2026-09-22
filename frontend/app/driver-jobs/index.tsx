import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Txt, Display, Icon, Loader, EmptyState, Badge, Btn } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const STATUS_TONE: any = { open: "warning", filled: "success" };

export default function DriverJobs() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await apiFetch<any[]>("/driver-jobs");
    setItems(data);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}><Icon name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <View>
          <Txt size={type.sm} color={colors.onSurfaceSecondary}>{isOwner ? "Your postings" : "Find work"}</Txt>
          <Display size={type.xl}>DRIVING JOBS</Display>
        </View>
        {isOwner ? (
          <Pressable testID="post-job-btn" onPress={() => router.push("/driver-jobs/create")} style={styles.addBtn}>
            <Icon name="plus" size={22} color={colors.onBrand} />
          </Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>
      {loading ? <Loader /> : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
          ListEmptyComponent={
            <EmptyState
              icon="account-hard-hat"
              title={isOwner ? "No jobs posted yet" : "No open jobs right now"}
              subtitle={isOwner ? "Post a free driving job to find truckers" : "Check back soon, or fill out your driver profile so owners can find you"}
            />
          }
          renderItem={({ item }) => (
            <Pressable testID={`job-${item.id}`} onPress={() => router.push(`/driver-jobs/${item.id}`)} style={styles.row}>
              <View style={styles.iconWrap}><Icon name="account-hard-hat" size={22} color={colors.brand} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt weight="bold" numberOfLines={1}>{item.title}</Txt>
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>{item.job_type} · {item.location}</Txt>
                {item.pay ? <Txt size={type.sm} color={colors.brand} weight="bold">{item.pay}</Txt> : null}
              </View>
              <Badge label={item.status} tone={STATUS_TONE[item.status]} />
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
  addBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  iconWrap: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
});
