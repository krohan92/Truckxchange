import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/api/client";
import { Txt, Display, Icon, Loader, Badge, Card, Btn } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

export default function DriverProfileView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    apiFetch<any>(`/users/${id}/driver-profile`).then(setDriver).finally(() => setLoading(false));
  }, [id]));

  if (loading || !driver) return <Loader />;
  const p = driver.driver_profile || {};

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}><Icon name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <Display size={type.xl}>DRIVER</Display>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <View style={styles.avatar}><Icon name="account" size={40} color={colors.onSurfaceSecondary} /></View>
          <Display size={type.xxl}>{driver.name}</Display>
          {driver.license_verified ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="check-decagram" size={16} color={colors.success} />
              <Txt size={type.sm} color={colors.success}>License Verified</Txt>
            </View>
          ) : null}
          {driver.renter_rating_count > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="star" size={16} color={colors.warning} />
              <Txt size={type.sm} color={colors.onSurfaceSecondary}>{driver.renter_rating.toFixed(1)} rating · {driver.renter_rating_count} trips as a renter</Txt>
            </View>
          ) : null}
        </View>

        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {p.cdl_class && p.cdl_class !== "None" ? <Badge label={`CDL ${p.cdl_class}`} tone="brand" /> : null}
            {p.availability ? <Badge label={p.availability} tone="muted" /> : null}
            {(p.endorsements || []).map((e: string) => <Badge key={e} label={e} tone="muted" />)}
          </View>
          {p.years_experience != null ? <Txt><Txt weight="bold">{p.years_experience}</Txt> years of experience</Txt> : null}
          {p.home_state ? <Txt color={colors.onSurfaceSecondary}>Based in {p.home_state}</Txt> : null}
          {p.bio ? <Txt color={colors.onSurfaceTertiary} style={{ lineHeight: 22, marginTop: spacing.sm }}>{p.bio}</Txt> : null}
        </Card>

        {p.phone_number ? (
          <Card style={{ gap: spacing.md }}>
            <Display size={type.lg}>REACH OUT DIRECTLY</Display>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Btn title="Call" icon="phone" onPress={() => Linking.openURL(`tel:${p.phone_number}`)} style={{ flex: 1 }} testID="call-driver-btn" />
              <Btn title="Text" icon="message-text-outline" variant="secondary" onPress={() => Linking.openURL(`sms:${p.phone_number}`)} style={{ flex: 1 }} testID="text-driver-btn" />
            </View>
          </Card>
        ) : (
          <Txt size={type.sm} color={colors.onSurfaceSecondary} style={{ textAlign: "center" }}>This driver hasn't added a phone number yet. To message them, reach out through a job they've applied to — open that job's Applicants list and tap Message there.</Txt>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  avatar: { width: 80, height: 80, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
});
