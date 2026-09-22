import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Txt, Display, Field, Btn, Icon, Chip, Loader } from "@/src/ui";
import StatePickerField from "@/src/components/StatePickerField";
import { colors, spacing, radius, type } from "@/src/theme";

const CDL_CLASSES = ["A", "B", "C", "None"];
const AVAILABILITIES = ["Full-time", "Part-time", "Local", "Regional", "OTR"];
const ENDORSEMENTS = ["Hazmat", "Tanker", "Doubles/Triples", "Passenger"];
const EQUIPMENT_TYPES = ["Sleeper", "Day Cab", "Semi", "Box", "Flatbed Truck", "Dump Truck", "Tow Truck", "Flatbed Trailer", "Reefer", "Dry Van", "Lowboy"];

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
  const [equipmentExperience, setEquipmentExperience] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [homeState, setHomeState] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
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
      setEquipmentExperience((p as any).equipment_experience || []);
      setBio(p.bio || "");
      setHomeState((p as any).home_state || "");
      setPhoneNumber((p as any).phone_number || "");
    }
    setLoading(false);
  }, [user]));

  const toggleEndorsement = (e: string) => {
    setEndorsements((list) => (list.includes(e) ? list.filter((x) => x !== e) : [...list, e]));
  };

  const toggleEquipment = (e: string) => {
    setEquipmentExperience((list) => (list.includes(e) ? list.filter((x) => x !== e) : [...list, e]));
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
          equipment_experience: equipmentExperience,
          bio,
          home_state: homeState,
          phone_number: phoneNumber,
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
        <Field label="Phone number" placeholder="(555) 123-4567" keyboardType="phone-pad" value={phoneNumber} onChangeText={setPhoneNumber} testID="input-phone" />
        <Txt size={type.sm} color={colors.onSurfaceSecondary} style={{ marginTop: -spacing.sm }}>Only shown to owners viewing your profile directly — not on the browse list.</Txt>
        <StatePickerField label="Home base state" value={homeState} onChange={setHomeState} testID="input-home-state" />

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
          <Txt size={type.sm} color={colors.onSurfaceSecondary} weight="medium" style={{ marginBottom: spacing.sm }}>Equipment experience</Txt>
          <Txt size={type.sm} color={colors.onSurfaceSecondary} style={{ marginBottom: spacing.sm }}>What have you driven? Select all that apply.</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {EQUIPMENT_TYPES.map((e) => (
              <Chip key={e} label={e} active={equipmentExperience.includes(e)} onPress={() => toggleEquipment(e)} />
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
