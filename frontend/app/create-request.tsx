import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/api/client";
import { Txt, Display, Field, Btn, Icon } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const CATS = [
  { key: "tow", label: "Tow", icon: "tow-truck" },
  { key: "repair", label: "Repair", icon: "wrench" },
  { key: "maintenance", label: "Maintenance", icon: "oil" },
];

export default function CreateRequest() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("tow");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!title.trim() || !location.trim()) { setError("Title and location are required"); return; }
    setBusy(true);
    try {
      await apiFetch("/requests", { method: "POST", body: { title, category, location, description } });
      router.back();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}><Icon name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <Display size={type.xl}>POST REQUEST</Display>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
        <Txt color={colors.onSurfaceSecondary} style={{ lineHeight: 22 }}>Describe your breakdown or service need. Tow & repair companies will bid — the cheapest wins the job.</Txt>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          {CATS.map((c) => (
            <Pressable key={c.key} testID={`cat-${c.key}`} onPress={() => setCategory(c.key)} style={[styles.catBtn, category === c.key && styles.catActive]}>
              <Icon name={c.icon} size={24} color={category === c.key ? colors.brand : colors.onSurfaceSecondary} />
              <Txt weight="bold" size={type.sm} color={category === c.key ? colors.onSurface : colors.onSurfaceSecondary}>{c.label}</Txt>
            </Pressable>
          ))}
        </View>
        <Field label="Title" placeholder="e.g. Blown tire on I-95" value={title} onChangeText={setTitle} testID="input-title" />
        <Field label="Location" placeholder="I-95 Mile 42, Richmond VA" value={location} onChangeText={setLocation} testID="input-location" />
        <Field label="Description" placeholder="Details for the service company…" value={description} onChangeText={setDescription} multiline />
        {error ? <Txt color={colors.error} size={type.sm}>{error}</Txt> : null}
        <Btn title="Post Request" icon="bullhorn" onPress={submit} loading={busy} testID="post-request-btn" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  catBtn: { flex: 1, alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  catActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
});
