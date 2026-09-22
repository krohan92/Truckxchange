import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, Linking, Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Txt, Display, Icon, Loader, Badge, Card, Btn, Field } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

export default function DriverJobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await apiFetch<any>(`/driver-jobs/${id}`);
    setJob(data);
  }, [id]);

  useFocusEffect(useCallback(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]));

  if (loading || !job) return <Loader />;

  const isPoster = user?.id === job.poster_id;
  const open = job.status === "open";

  const apply = async () => {
    setError("");
    setBusy(true);
    try {
      await apiFetch(`/driver-jobs/${id}/apply`, { method: "POST", body: { note } });
      setNote("");
      await load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const [hireBusy, setHireBusy] = useState<string | null>(null);

  const hire = async (applicationId: string) => {
    setHireBusy(applicationId);
    try {
      const res = await apiFetch<{ checkout_url: string }>(`/driver-jobs/${id}/hire`, { method: "POST", body: { bid_id: applicationId } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await Linking.openURL(res.checkout_url);
    } catch (e: any) {
      Alert.alert("Couldn't start payment", e.message || "Try again in a moment.");
    } finally {
      setHireBusy(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}><Icon name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <Display size={type.xl}>JOB</Display>
        <Pressable testID="message-btn" onPress={() => router.push(`/messages/job/${id}`)} style={styles.iconBtn}>
          <Icon name="message-outline" size={22} color={colors.onSurface} />
        </Pressable>
      </View>
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
          <View style={styles.catIcon}><Icon name="account-hard-hat" size={28} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <Display size={type.xxl}>{job.title}</Display>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="map-marker" size={14} color={colors.onSurfaceSecondary} />
              <Txt size={type.sm} color={colors.onSurfaceSecondary}>{job.job_type} · {job.location}</Txt>
            </View>
          </View>
          <Badge label={job.status} tone={open ? "warning" : "success"} />
        </View>

        {job.pay ? <Txt weight="bold" color={colors.brand} size={type.lg}>{job.pay}</Txt> : null}
        {job.cdl_class_required && job.cdl_class_required !== "None" ? <Txt size={type.sm} color={colors.onSurfaceSecondary}>Requires CDL Class {job.cdl_class_required}</Txt> : null}
        {job.min_years_experience ? <Txt size={type.sm} color={colors.onSurfaceSecondary}>{job.min_years_experience}+ years experience preferred</Txt> : null}
        {job.description ? <Txt color={colors.onSurfaceTertiary} style={{ lineHeight: 22 }}>{job.description}</Txt> : null}
        <Txt size={type.sm} color={colors.onSurfaceSecondary}>Posted by {job.poster_name}</Txt>

        {!isPoster && user?.role === "renter" && open && !job.my_application && (
          <Card style={{ gap: spacing.md }}>
            <Display size={type.lg}>APPLY TO THIS JOB</Display>
            <Field label="Note to the employer (optional)" placeholder="Why you're a good fit, availability, etc." value={note} onChangeText={setNote} multiline testID="apply-note" />
            {error ? <Txt color={colors.error} size={type.sm}>{error}</Txt> : null}
            <Btn title="Submit Application" icon="send" onPress={apply} loading={busy} testID="submit-application-btn" />
          </Card>
        )}
        {job.my_application ? (
          <Card style={{ gap: 4 }}>
            <Txt weight="bold">You applied {job.my_application.status === "hired" ? "— you were hired!" : job.my_application.status === "not_selected" ? "— not selected this time" : ""}</Txt>
            {job.my_application.note ? <Txt size={type.sm} color={colors.onSurfaceSecondary}>{job.my_application.note}</Txt> : null}
          </Card>
        ) : null}

        {isPoster && (
          <>
            <Display size={type.lg}>APPLICANTS ({job.applications?.length || 0})</Display>
            {(!job.applications || job.applications.length === 0) ? (
              <Txt color={colors.onSurfaceSecondary}>No applicants yet.</Txt>
            ) : (
              job.applications.map((app: any) => {
                const hired = app.status === "hired";
                return (
                  <Card key={app.id} style={{ gap: spacing.sm, borderColor: hired ? colors.success : colors.border }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Display size={type.lg}>{app.driver_name}</Display>
                      {hired ? <Badge label="Hired" tone="success" /> : app.status === "not_selected" ? <Badge label="Not Selected" tone="muted" /> : null}
                    </View>
                    {app.note ? <Txt size={type.sm} color={colors.onSurfaceTertiary}>{app.note}</Txt> : null}
                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <Btn title="View Profile" variant="secondary" icon="account" onPress={() => router.push(`/driver/${app.driver_id}`)} style={{ flex: 1, height: 40 }} testID={`view-driver-${app.id}`} />
                      {open && (
                        <Btn title="Hire" icon="credit-card" onPress={() => hire(app.id)} loading={hireBusy === app.id} style={{ flex: 1, height: 40 }} testID={`hire-${app.id}`} />
                      )}
                    </View>
                  </Card>
                );
              })
            )}
          </>
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
