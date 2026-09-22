import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { apiFetch } from "@/src/api/client";
import { Txt, Display, Field, Btn, Icon, Chip } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const JOB_TYPES = ["Full-time", "Part-time", "Local", "Regional", "OTR"];
const CDL_CLASSES = ["A", "B", "C", "None"];

export default function CreateDriverJob() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [jobType, setJobType] = useState("Local");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [pay, setPay] = useState("");
  const [cdlClass, setCdlClass] = useState<string | null>(null);
  const [minExperience, setMinExperience] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const useCurrentLocation = async () => {
    setLocBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const places = await Location.reverseGeocodeAsync(pos.coords);
      if (places?.[0]) {
        const p = places[0];
        setLocation([p.city, p.region].filter(Boolean).join(", ") || location);
      }
    } catch {}
    finally { setLocBusy(false); }
  };

  const submit = async () => {
    setError("");
    if (!title.trim() || !location.trim()) { setError("Title and location are required"); return; }
    setBusy(true);
    try {
      await apiFetch("/driver-jobs", {
        method: "POST",
        body: {
          title, description, location, job_type: jobType, pay,
          cdl_class_required: cdlClass === "None" ? "None" : cdlClass,
          min_years_experience: minExperience ? parseFloat(minExperience) : null,
          latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null,
        },
      });
      router.back();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}><Icon name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <Display size={type.xl}>POST A JOB</Display>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
        <Txt color={colors.onSurfaceSecondary} style={{ lineHeight: 22 }}>Posting is free — RigRent doesn't charge employers to list a driving job. A small placement fee applies only if you actually hire someone.</Txt>
        <Field label="Job title" placeholder="e.g. Local Box Truck Driver" value={title} onChangeText={setTitle} testID="input-title" />
        <View>
          <Txt size={type.sm} color={colors.onSurfaceSecondary} weight="medium" style={{ marginBottom: spacing.sm }}>Job type</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {JOB_TYPES.map((t) => (
              <Chip key={t} label={t} active={jobType === t} onPress={() => setJobType(t)} />
            ))}
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}><Field label="Location" placeholder="City, State" value={location} onChangeText={setLocation} testID="input-location" /></View>
          <Btn title={locBusy ? "Locating…" : "Use My Location"} variant="secondary" icon="crosshairs-gps" onPress={useCurrentLocation} loading={locBusy} />
        </View>
        <Field label="Pay (optional)" placeholder="e.g. $0.60/mi or $22/hr" value={pay} onChangeText={setPay} testID="input-pay" />
        <View>
          <Txt size={type.sm} color={colors.onSurfaceSecondary} weight="medium" style={{ marginBottom: spacing.sm }}>CDL class required (optional)</Txt>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {CDL_CLASSES.map((c) => (
              <Chip key={c} label={c} active={cdlClass === c} onPress={() => setCdlClass(cdlClass === c ? null : c)} />
            ))}
          </View>
        </View>
        <Field label="Minimum years experience (optional)" placeholder="2" keyboardType="decimal-pad" value={minExperience} onChangeText={setMinExperience} />
        <Field label="Description" placeholder="Route, schedule, equipment, expectations…" value={description} onChangeText={setDescription} multiline />
        {error ? <Txt color={colors.error} size={type.sm}>{error}</Txt> : null}
        <Btn title="Post Job" icon="bullhorn" onPress={submit} loading={busy} testID="post-job-submit-btn" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
});
