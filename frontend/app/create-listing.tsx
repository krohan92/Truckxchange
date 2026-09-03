import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, uploadFile, fileUrl } from "@/src/api/client";
import { Txt, Display, Field, Btn, Icon, Chip } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const CATS = ["Semi", "Box", "Flatbed", "Reefer", "Dry Van", "Lowboy"];

export default function CreateListing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"truck" | "trailer">("truck");
  const [category, setCategory] = useState("Semi");
  const [location, setLocation] = useState("");
  const [rate, setRate] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [dot, setDot] = useState("");
  const [mc, setMc] = useState("");
  const [vin, setVin] = useState("");
  const [plate, setPlate] = useState("");
  const [insProvider, setInsProvider] = useState("");
  const [insPolicy, setInsPolicy] = useState("");
  const [insExpiry, setInsExpiry] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsMultipleSelection: true, selectionLimit: 6 });
    if (res.canceled || !res.assets?.length) return;
    setUploading(true);
    try {
      for (const a of res.assets) {
        const path = await uploadFile(a.uri, a.fileName || "rig.jpg", a.mimeType || "image/jpeg");
        setPhotos((p) => [...p, path]);
      }
    } catch (e: any) { setError("Photo upload failed"); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    setError("");
    if (!title.trim() || !location.trim() || !rate) { setError("Title, location and daily rate are required"); return; }
    if (!dot.trim() || !insProvider.trim() || !insPolicy.trim() || !insExpiry.trim()) {
      setError("DOT number and insurance details are required for compliance");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/listings", {
        method: "POST",
        body: {
          title, kind, category, location,
          daily_rate: parseFloat(rate) || 0,
          year: year ? parseInt(year, 10) : null,
          make, capacity, description,
          photos,
          dot_number: dot, mc_number: mc, vin, plate,
          insurance_provider: insProvider, insurance_policy: insPolicy, insurance_expiry: insExpiry,
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
        <Display size={type.xl}>LIST A RIG</Display>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: spacing.sm }}>
          <Txt size={type.sm} color={colors.onSurfaceSecondary} weight="medium">Photos {photos.length ? `(${photos.length})` : ""}</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {photos.map((p, i) => (
              <View key={p} style={styles.thumbWrap}>
                <Image source={{ uri: fileUrl(p) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <Pressable testID={`remove-photo-${i}`} onPress={() => setPhotos((arr) => arr.filter((x) => x !== p))} style={styles.removeThumb}>
                  <Icon name="close" size={14} color={colors.onSurface} />
                </Pressable>
              </View>
            ))}
            <Pressable testID="pick-photo" onPress={pickPhoto} style={styles.addTile}>
              <Icon name={uploading ? "progress-upload" : "camera-plus"} size={28} color={colors.onSurfaceSecondary} />
              <Txt size={type.sm} color={colors.onSurfaceSecondary}>{uploading ? "Uploading…" : "Add"}</Txt>
            </Pressable>
          </ScrollView>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          {(["truck", "trailer"] as const).map((k) => (
            <Pressable key={k} testID={`kind-${k}`} onPress={() => setKind(k)} style={[styles.kindBtn, kind === k && styles.kindActive]}>
              <Icon name={k === "truck" ? "truck" : "truck-trailer"} size={22} color={kind === k ? colors.brand : colors.onSurfaceSecondary} />
              <Txt weight="bold" color={kind === k ? colors.onSurface : colors.onSurfaceSecondary}>{k === "truck" ? "Truck" : "Trailer"}</Txt>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Txt size={type.sm} color={colors.onSurfaceSecondary} weight="medium">Category</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {CATS.map((c) => <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />)}
          </View>
        </View>

        <Field label="Title" placeholder="e.g. Freightliner Cascadia Sleeper" value={title} onChangeText={setTitle} testID="input-title" />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><Field label="Daily rate ($)" placeholder="320" keyboardType="number-pad" value={rate} onChangeText={setRate} testID="input-rate" /></View>
          <View style={{ flex: 1 }}><Field label="Year" placeholder="2022" keyboardType="number-pad" value={year} onChangeText={setYear} /></View>
        </View>
        <Field label="Location" placeholder="City, State" value={location} onChangeText={setLocation} testID="input-location" />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><Field label="Make" placeholder="Freightliner" value={make} onChangeText={setMake} /></View>
          <View style={{ flex: 1 }}><Field label="Capacity" placeholder="80,000 lb" value={capacity} onChangeText={setCapacity} /></View>
        </View>
        <Field label="Description" placeholder="Condition, features, extras…" value={description} onChangeText={setDescription} multiline />

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}>
          <Icon name="shield-check" size={20} color={colors.brand} />
          <Display size={type.lg}>COMPLIANCE & SAFETY</Display>
        </View>
        <Txt size={type.sm} color={colors.onSurfaceSecondary}>Required — a rig cannot go live without a valid DOT number and active insurance.</Txt>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><Field label="DOT number" placeholder="DOT-123456" value={dot} onChangeText={setDot} testID="input-dot" /></View>
          <View style={{ flex: 1 }}><Field label="MC number" placeholder="MC-654321" value={mc} onChangeText={setMc} /></View>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><Field label="VIN" placeholder="1FUJA6..." autoCapitalize="characters" value={vin} onChangeText={setVin} /></View>
          <View style={{ flex: 1 }}><Field label="Plate" placeholder="TX-RIG100" autoCapitalize="characters" value={plate} onChangeText={setPlate} /></View>
        </View>
        <Field label="Insurance provider" placeholder="e.g. Progressive Commercial" value={insProvider} onChangeText={setInsProvider} testID="input-ins-provider" />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><Field label="Policy #" placeholder="POL-000123" value={insPolicy} onChangeText={setInsPolicy} testID="input-ins-policy" /></View>
          <View style={{ flex: 1 }}><Field label="Insurance expiry" placeholder="YYYY-MM-DD" value={insExpiry} onChangeText={setInsExpiry} testID="input-ins-expiry" /></View>
        </View>

        {error ? <Txt color={colors.error} size={type.sm}>{error}</Txt> : null}
        <Btn title="Publish Listing" icon="check" onPress={submit} loading={busy} testID="publish-btn" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  photoBox: { height: 180, borderRadius: radius.lg, borderWidth: 2, borderStyle: "dashed", borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbWrap: { width: 110, height: 110, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  removeThumb: { position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(15,15,18,0.7)", alignItems: "center", justifyContent: "center" },
  addTile: { width: 110, height: 110, borderRadius: radius.md, borderWidth: 2, borderStyle: "dashed", borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", gap: 4 },
  kindBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  kindActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
});
