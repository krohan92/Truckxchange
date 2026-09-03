import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Txt, Display, Icon, Loader, Badge, Card, Btn, Field } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const CAT_ICON: any = { tow: "tow-truck", repair: "wrench", maintenance: "oil" };

export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [req, setReq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState("");
  const [eta, setEta] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await apiFetch<any>(`/requests/${id}`);
    setReq(data);
  }, [id]);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));

  if (loading || !req) return <Loader />;

  const isVendor = user?.role === "vendor";
  const isPoster = user?.id === req.poster_id;
  const open = req.status === "open";

  const submitBid = async () => {
    setError("");
    if (!price || !eta.trim()) { setError("Enter your price and ETA"); return; }
    setBusy(true);
    try {
      await apiFetch(`/requests/${id}/bids`, { method: "POST", body: { price: parseFloat(price) || 0, eta, note } });
      setPrice(""); setEta(""); setNote("");
      await load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const accept = async (bidId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await apiFetch(`/requests/${id}/accept`, { method: "POST", body: { bid_id: bidId } });
    await load();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}><Icon name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <Display size={type.xl}>REQUEST</Display>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
          <View style={styles.catIcon}><Icon name={CAT_ICON[req.category]} size={28} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <Display size={type.xxl}>{req.title}</Display>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="map-marker" size={14} color={colors.onSurfaceSecondary} />
              <Txt size={type.sm} color={colors.onSurfaceSecondary}>{req.location}</Txt>
            </View>
          </View>
          <Badge label={req.status} tone={open ? "warning" : "success"} />
        </View>
        {req.description ? <Txt color={colors.onSurfaceTertiary} style={{ lineHeight: 22 }}>{req.description}</Txt> : null}
        <Txt size={type.sm} color={colors.onSurfaceSecondary}>Posted by {req.poster_name}</Txt>

        {isVendor && open && (
          <Card style={{ gap: spacing.md }}>
            <Display size={type.lg}>PLACE YOUR BID</Display>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}><Field label="Price ($)" placeholder="250" keyboardType="number-pad" value={price} onChangeText={setPrice} testID="input-price" /></View>
              <View style={{ flex: 1 }}><Field label="ETA" placeholder="45 min" value={eta} onChangeText={setEta} testID="input-eta" /></View>
            </View>
            <Field label="Note (optional)" placeholder="Heavy-duty wrecker, 24/7" value={note} onChangeText={setNote} />
            {error ? <Txt color={colors.error} size={type.sm}>{error}</Txt> : null}
            <Btn title="Submit Bid" icon="gavel" onPress={submitBid} loading={busy} testID="submit-bid" />
          </Card>
        )}

        <Display size={type.lg}>BIDS ({req.bids.length})</Display>
        {req.bids.length === 0 ? (
          <Txt color={colors.onSurfaceSecondary}>No bids yet. {open ? "Companies will bid soon." : ""}</Txt>
        ) : (
          req.bids.map((bid: any, idx: number) => {
            const cheapest = idx === 0;
            const accepted = bid.status === "accepted";
            return (
              <Card key={bid.id} style={{ gap: spacing.sm, borderColor: accepted ? colors.success : cheapest ? colors.brand : colors.border, backgroundColor: cheapest && open ? colors.brandTertiary : colors.surfaceSecondary }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Display size={type.lg}>{bid.vendor_name}</Display>
                  <Display size={type.xxl} color={colors.brand}>${bid.price}</Display>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                  {cheapest && open ? <Badge label="Lowest Bid" tone="brand" /> : null}
                  {accepted ? <Badge label="Accepted" tone="success" /> : null}
                  <Icon name="clock-outline" size={14} color={colors.onSurfaceSecondary} />
                  <Txt size={type.sm} color={colors.onSurfaceSecondary}>ETA {bid.eta}</Txt>
                </View>
                {bid.note ? <Txt size={type.sm} color={colors.onSurfaceTertiary}>{bid.note}</Txt> : null}
                {isPoster && open && (
                  <Btn title="Accept Bid" icon="check" onPress={() => accept(bid.id)} style={{ height: 44 }} testID={`accept-bid-${bid.id}`} />
                )}
              </Card>
            );
          })
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  catIcon: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
});
