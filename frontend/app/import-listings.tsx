import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, Linking } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bulkTemplateUrl, uploadListingsSheet } from "@/src/api/client";
import { goBack } from "@/src/nav";
import { Txt, Display, Btn, Icon, Card } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

type Picked = { uri: string; name: string; mime: string };

export default function ImportListings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<Picked | null>(null);
  const [report, setReport] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);

  const pick = async () => {
    setError(""); setReport(null); setDone(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const picked = { uri: a.uri, name: a.name || "listings.csv", mime: a.mimeType || "" };
      setFile(picked);
      await check(picked);
    } catch (e: any) {
      setError(e?.message || "Could not open the file");
    }
  };

  const check = async (f: Picked) => {
    setBusy(true); setError("");
    try {
      const r = await uploadListingsSheet(f.uri, f.name, f.mime, true);
      setReport(r);
    } catch (e: any) {
      setReport(null);
      setError(e?.message || "Could not check the file");
    } finally { setBusy(false); }
  };

  const doImport = async () => {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const r = await uploadListingsSheet(file.uri, file.name, file.mime, false);
      setDone(r.imported ?? 0);
      setReport(null);
    } catch (e: any) {
      setError(e?.message || "Import failed");
    } finally { setBusy(false); }
  };

  const canImport = report && report.error_count === 0 && report.valid > 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => goBack(router)} style={styles.iconBtn}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Display size={type.xl}>IMPORT RIGS</Display>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}>
        <Txt color={colors.onSurfaceSecondary} style={{ lineHeight: 22 }}>
          Add many trucks and trailers at once from a spreadsheet instead of typing each one.
        </Txt>

        <Card style={{ gap: spacing.md }}>
          <Display size={type.lg}>1. GET THE TEMPLATE</Display>
          <Txt size={type.sm} color={colors.onSurfaceSecondary}>
            Download the template, open it in Excel or Google Sheets, and fill in one row per truck or trailer. Required columns: title, kind (truck or trailer), category, location, price_per_mile, dot_number, insurance_provider, insurance_policy, insurance_expiry (like 2027-06-30). Photos can be added after import, or by putting a link in photo_url.
          </Txt>
          <Btn title="Download Template" icon="download" variant="secondary" onPress={() => Linking.openURL(bulkTemplateUrl()).catch(() => {})} testID="download-template-btn" />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Display size={type.lg}>2. UPLOAD YOUR FILE</Display>
          <Txt size={type.sm} color={colors.onSurfaceSecondary}>CSV or Excel (.xlsx), up to 200 rows. We check every row before anything is saved.</Txt>
          <Btn title={file ? "Choose a Different File" : "Choose File"} icon="file-upload" onPress={pick} loading={busy} testID="pick-file-btn" />
          {file ? <Txt size={type.sm} weight="bold">{file.name}</Txt> : null}
        </Card>

        {error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={16} color={colors.error} />
            <Txt color={colors.error} size={type.sm} style={{ flex: 1 }}>{error}</Txt>
          </View>
        ) : null}

        {report ? (
          <Card style={{ gap: spacing.md, borderColor: canImport ? colors.success : colors.error }}>
            <Display size={type.lg}>{canImport ? "READY TO IMPORT" : "FIX THESE ROWS"}</Display>
            <Txt>{report.total} rows found: {report.valid} OK{report.error_count ? `, ${report.error_count} with problems` : ""}.</Txt>
            {report.errors?.map((e: any) => (
              <View key={e.row} style={{ gap: 2 }}>
                <Txt weight="bold" size={type.sm}>Row {e.row}{e.title ? ` — ${e.title}` : ""}</Txt>
                <Txt size={type.sm} color={colors.error}>{e.errors.join("; ")}</Txt>
              </View>
            ))}
            {report.error_count > report.errors?.length ? <Txt size={type.sm} color={colors.onSurfaceSecondary}>…and more. Fix these and upload again.</Txt> : null}
            {canImport ? (
              <Btn title={`Import ${report.valid} Rig${report.valid === 1 ? "" : "s"}`} icon="check" onPress={doImport} loading={busy} testID="confirm-import-btn" />
            ) : (
              <Txt size={type.sm} color={colors.onSurfaceSecondary}>Nothing is imported until every row is correct. Fix the file and choose it again.</Txt>
            )}
          </Card>
        ) : null}

        {done !== null ? (
          <Card style={{ gap: spacing.md, borderColor: colors.success }}>
            <Display size={type.lg}>IMPORTED</Display>
            <Txt>{done} rig{done === 1 ? "" : "s"} added to your fleet.</Txt>
            <Btn title="View My Rigs" icon="truck" onPress={() => router.replace("/(tabs)/rigs")} testID="view-rigs-btn" />
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(239,68,68,0.1)", padding: spacing.md, borderRadius: radius.md },
});
