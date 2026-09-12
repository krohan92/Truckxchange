
import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/api/client";
import { Txt, Display, Icon, Loader, Card, Btn, Field, EmptyState } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

export default function AdminDisputes() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<any[]>("/admin/disputes");
    setItems(data);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));

  const resolve = async (bid: string) => {
    setBusy(bid);
    try {
      await apiFetch(`/admin/disputes/${bid}/resolve`, {
        method: "POST",
        body: { resolution: notes[bid] || "Reviewed by admin", charge_amount: parseFloat(amounts[bid] || "0") || 0 },
      });
      await load();
    } catch {}
    finally { setBusy(null); }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}><Icon name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <Display size={type.xl}>DISPUTES</Display>
        <View style={{ width: 40 }} />
      </View>
      {loading ? <Loader /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <EmptyState icon="scale-balance" title="No open disputes" subtitle="Flagged trips will appear here for review" />
          ) : items.map((b) => (
            <Card key={b.id} style={{ gap: spacing.sm }}>
              <Display size={type.lg}>{b.listing_title}</Display>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>Renter</Txt>
                <Txt size={type.sm} weight="bold">{b.renter_name}</Txt>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Txt size={type.sm} color={colors.onSurfaceSecondary}>Owner</Txt>
                <Txt size={type.sm} weight="bold">{b.owner_name}</Txt>
              </View>
              {b.miles_driven != null ? (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Txt size={type.sm} color={colors.onSurfaceSecondary}>Miles driven / included</Txt>
                  <Txt size={type.sm} weight="bold">{b.miles_driven} / {b.included_miles ?? "—"}</Txt>
                </View>
              ) : null}
              <View style={styles.reasonBox}>
                <Icon name="flag" size={14} color={colors.error} />
                <Txt size={type.sm} style={{ flex: 1 }}>{b.dispute_reason}</Txt>
              </View>
              <Field label="Final charge amount ($, 0 if none)" placeholder="0" keyboardType="decimal-pad" value={amounts[b.id] || ""} onChangeText={(v) => setAmounts((a) => ({ ...a, [b.id]: v }))} testID={`resolve-amount-${b.id}`} />
              <Field label="Resolution note" placeholder="Explain the decision" value={notes[b.id] || ""} onChangeText={(v) => setNotes((n) => ({ ...n, [b.id]: v }))} multiline testID={`resolve-note-${b.id}`} />
              <Btn title="Resolve" icon="check" onPress={() => resolve(b.id)} loading={busy === b.id} testID={`resolve-btn-${b.id}`} />
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
  reasonBox: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.sm, alignItems: "flex-start" },
});
