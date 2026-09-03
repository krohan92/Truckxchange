import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, fileUrl } from "@/src/api/client";
import { Txt, Display, Icon, Loader, Badge, Card, Btn, EmptyState } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const TONE: any = { verified: "success", rejected: "error", expired: "error" };

export default function Admin() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await apiFetch<any[]>("/admin/verifications");
    setItems(data);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));

  const review = async (vid: string, approved: boolean) => {
    await apiFetch(`/admin/verifications/${vid}/review`, { method: "POST", body: { approved, note: "" } });
    await load();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}><Icon name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <Display size={type.xl}>VERIFICATIONS</Display>
        <View style={{ width: 40 }} />
      </View>
      {loading ? <Loader /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <EmptyState icon="clipboard-check-outline" title="Nothing to review" subtitle="Submitted documents will appear here" />
          ) : items.map((v) => (
            <Card key={v.id} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Display size={type.lg} style={{ textTransform: "capitalize" }}>{v.doc_type}</Display>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {v.admin_reviewed ? <Badge label="Reviewed" tone="muted" /> : null}
                  <Badge label={v.status} tone={TONE[v.status] || "warning"} />
                </View>
              </View>
              {v.storage_path ? <Image source={{ uri: fileUrl(v.storage_path) }} style={styles.img} contentFit="cover" /> : null}
              {Object.entries(v.extracted || {}).filter(([k]) => !["is_readable", "notes"].includes(k)).map(([k, val]) => (
                <View key={k} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Txt size={type.sm} color={colors.onSurfaceSecondary}>{k.replace(/_/g, " ")}</Txt>
                  <Txt size={type.sm} weight="bold">{String(val ?? "—")}</Txt>
                </View>
              ))}
              <View style={{ flexDirection: "row", gap: spacing.md, marginTop: 4 }}>
                <Btn title="Reject" variant="ghost" onPress={() => review(v.id, false)} style={{ flex: 1, height: 44 }} testID={`reject-${v.id}`} />
                <Btn title="Approve" onPress={() => review(v.id, true)} style={{ flex: 1, height: 44 }} testID={`approve-${v.id}`} />
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  img: { height: 160, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
});
