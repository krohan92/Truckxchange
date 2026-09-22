import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Txt, Display, Field, Btn, Icon, Chip, Loader } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const CDL_CLASSES = ["A", "B", "C", "None"];
const AVAILABILITIES = ["Full-time", "Part-time", "Local", "Regional", "OTR"];
const ENDORSEMENTS = ["Hazmat", "Tanker", "Doubles/Triples", "Passenger"];

export default function DriverProfileEdit() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [openToWork, setOpenToWork] = useState(true);
  const [yearsExperience, setYearsExperience] = useState("");
  const [cdlClass, setCdlClass] = useState<string | null>(null);
  const [availability, setAvailability] = useState<string | null>(null);
  const [endorsements, setEndorsements] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [homeLocation, setHomeLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useFocusEffect(useCallback(() => {
    const p = user?.driver_profile;
    if (p) {
      setOpenToWork(p.open_to_work ?? true);
      setYearsExperience(p.years_experience != null ? String(p.years_experience) : "");
      setCdlClass(p.cdl_class || null);
      setAvailability(p.availability || null);
      setEndorsements(p.endorsements || []);
      setBio(p.bio || "");
      setHomeLocation(p.home_location || "");
    }
    setLoading(false);
  }, [user]));

  const toggleEndorsement = (e: string) => {
    setEndorsements((list) => (list.includes(e) ? list.filter((x) => x !== e) : [...list, e]));
  };

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      await apiFetch("/driver-profile", {
        method: "POST",
        body: {
          open_to_work: openToWork,
          years_experience: yearsExperience ? parseFloat(yearsExperience) : null,
          cdl_class: cdlClass,
          availability,
          endorsements,
          bio,
          home_location: homeLocation,
        },
      });
      await refresh();
      setSaved(true);
    } catch {}
    finally { setBusy(false); }
  };

  if (loading) return <Loader />;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}><Icon name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <Display size={type.xl}>DRIVER PROFILE</Display>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
        <Pressable testID="toggle-open-to-work" onPress={() => setOpenToWork((v) => !v)} style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Txt weight="bold">Open to driving jobs</Txt>
            <Txt size={type.sm} color={colors.onSurfaceSecondary}>Fleet owners can find and message you</Txt>
          </View>
          <Icon name={openToWork ? "toggle-switch" : "toggle-switch-off-outline"} size={38} color={openToWork ? colors.brand : colors.onSurfaceSecondary} />
        </Pressable>

        <Field label="Years of experience" placeholder="5" keyboardType="decimal-pad" value={yearsExperience} onChangeText={setYearsExperience} testID="input-years" />
        <Field label="Home base" placeholder="City, State" value={homeLocation} onChangeText={setHomeLocation} testID="input-home-location" />

        <View>
          <Txt size={type.sm} color={colors.onSurfaceSecondary} weight="medium" style={{ marginBottom: spacing.sm }}>CDL class</Txt>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {CDL_CLASSES.map((c) => (
              <Chip key={c} label={c} active={cdlClass === c} onPress={() => setCdlClass(cdlClass === c ? null : c)} />
            ))}
          </View>
        </View>

        <View>
          <Txt size={type.sm} color={colors.onSurfaceSecondary} weight="medium" style={{ marginBottom: spacing.sm }}>Endorsements</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {ENDORSEMENTS.map((e) => (
              <Chip key={e} label={e} active={endorsements.includes(e)} onPress={() => toggleEndorsement(e)} />
            ))}
          </View>
        </View>

        <View>
          <Txt size={type.sm} color={colors.onSurfaceSecondary} weight="medium" style={{ marginBottom: spacing.sm }}>Availability</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {AVAILABILITIES.map((a) => (
              <Chip key={a} label={a} active={availability === a} onPress={() => setAvailability(availability === a ? null : a)} />
            ))}
          </View>
        </View>

        <Field label="About you" placeholder="Experience, equipment you've run, what you're looking for…" value={bio} onChangeText={setBio} multiline testID="input-bio" />

        <Btn title={saved ? "Saved ✓" : "Save Profile"} icon="content-save" onPress={save} loading={busy} testID="save-driver-profile-btn" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
});
