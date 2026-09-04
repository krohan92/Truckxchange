import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, Linking } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Txt, Display, Btn, Icon, Card, Badge } from "@/src/ui";
import { colors, spacing, radius, fonts, type } from "@/src/theme";

type DocType = "license" | "insurance";

export default function Verify() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh } = useAuth();
  const [tab, setTab] = useState<DocType>("license");
  const [preview, setPreview] = useState<Record<DocType, string | null>>({ license: null, insurance: null });
  const [result, setResult] = useState<Record<DocType, any>>({ license: null, insurance: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (fromCamera: boolean) => {
    setError("");
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          if (!perm.canAskAgain) {
            setError("Camera access is blocked. Open Settings to enable it.");
          } else {
            setError("Camera permission is needed to scan your document.");
          }
          return;
        }
      }
      const fn = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const res = await fn({ mediaTypes: ["images"], quality: 0.7, base64: true, allowsEditing: true });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setPreview((p) => ({ ...p, [tab]: asset.uri }));
      await scan(asset.base64!);
    } catch (e: any) {
      setError(e.message || "Could not open camera");
    }
  };

  const scan = async (base64: string) => {
    setBusy(true);
    setError("");
    setResult((r) => ({ ...r, [tab]: null }));
    try {
      const res = await apiFetch<any>("/verify/document", {
        method: "POST",
        body: { doc_type: tab, image_base64: base64 },
      });
      setResult((r) => ({ ...r, [tab]: res }));
      await refresh();
      Haptics.notificationAsync(
        res.passed ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      ).catch(() => {});
    } catch (e: any) {
      setError(e.message || "Verification failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const r = result[tab];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Display size={type.xl}>VERIFICATION</Display>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        {(["license", "insurance"] as DocType[]).map((t) => (
          <Pressable key={t} testID={`tab-${t}`} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabActive]}>
            <Icon name={t === "license" ? "card-account-details" : "shield-check"} size={18} color={tab === t ? colors.brand : colors.onSurfaceSecondary} />
            <Txt weight="bold" color={tab === t ? colors.onSurface : colors.onSurfaceSecondary}>
              {t === "license" ? "Driver License" : "Insurance"}
            </Txt>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
        <Txt color={colors.onSurfaceSecondary} style={{ lineHeight: 22 }}>
          {tab === "license"
            ? "Snap a clear photo of your driver license. Our scanner reads your name, class and expiry — you must have a valid, non-expired license to book."
            : "Upload proof of active insurance. We read the provider, policy number and expiry to keep the marketplace safe."}
        </Txt>

        <View style={styles.frame}>
          {preview[tab] ? (
            <Image source={{ uri: preview[tab]! }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={{ alignItems: "center", gap: spacing.sm }}>
              <Icon name={tab === "license" ? "card-account-details-outline" : "file-document-outline"} size={48} color={colors.onSurfaceSecondary} />
              <Txt color={colors.onSurfaceSecondary}>Position document inside the frame</Txt>
            </View>
          )}
          {busy && (
            <View style={styles.scanOverlay}>
              <Icon name="line-scan" size={40} color={colors.brand} />
              <Txt color={colors.brand} weight="bold" style={{ marginTop: spacing.sm }}>Scanning…</Txt>
            </View>
          )}
        </View>

        {r && (
          <Card style={{ gap: spacing.md, borderColor: r.passed ? colors.success : colors.error }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Icon name={r.passed ? "check-decagram" : "alert-decagram"} size={22} color={r.passed ? colors.success : colors.error} />
              <Display size={type.lg}>{r.passed ? "VERIFIED" : "NOT ACCEPTED"}</Display>
              {r.expired === true ? <Badge label="Expired" tone="error" /> : null}
            </View>
            {Object.entries(r.extracted || {})
              .filter(([k]) => !["is_readable", "notes"].includes(k))
              .map(([k, v]) => (
                <View key={k} style={styles.kv}>
                  <Txt size={type.sm} color={colors.onSurfaceSecondary}>{k.replace(/_/g, " ")}</Txt>
                  <Txt weight="bold" style={{ flex: 1, textAlign: "right" }}>{String(v ?? "—")}</Txt>
                </View>
              ))}
            {r.extracted?.notes ? <Txt size={type.sm} color={colors.onSurfaceSecondary}>{r.extracted.notes}</Txt> : null}
          </Card>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={16} color={colors.error} />
            <Txt color={colors.error} size={type.sm} style={{ flex: 1 }}>{error}</Txt>
            {error.includes("Settings") ? <Btn title="Open Settings" variant="ghost" onPress={() => Linking.openSettings()} style={{ height: 36 }} /> : null}
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Btn title="Take Photo" icon="camera" onPress={() => pick(true)} style={{ flex: 1 }} loading={busy} testID="camera-btn" />
          <Btn title="Upload" icon="image" variant="secondary" onPress={() => pick(false)} style={{ flex: 1 }} loading={busy} testID="upload-btn" />
        </View>

        {r?.passed && (
          <Btn title="Done" icon="arrow-right" onPress={() => router.back()} testID="done-btn" />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  tabActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  frame: { height: 220, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.borderStrong, borderStyle: "dashed", backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  scanOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center" },
  kv: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, alignItems: "center" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(239,68,68,0.1)", padding: spacing.md, borderRadius: radius.md },
});
