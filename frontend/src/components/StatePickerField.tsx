import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from "react-native";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Display, Icon } from "@/src/ui";

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri",
  "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming", "Washington D.C.",
];

export default function StatePickerField({
  label,
  value,
  onChange,
  placeholder = "Select a state",
  testID,
}: {
  label?: string;
  value: string;
  onChange: (state: string) => void;
  placeholder?: string;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);

  const pick = (state: string) => {
    onChange(state);
    setOpen(false);
  };

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Txt size={type.sm} color={colors.onSurfaceSecondary} weight="medium">{label}</Txt> : null}
      <Pressable testID={testID} onPress={() => setOpen(true)} style={styles.trigger}>
        <Icon name="map-marker-outline" size={18} color={colors.onSurfaceSecondary} />
        <Text style={[styles.triggerText, !value && { color: colors.onSurfaceSecondary }]}>
          {value || placeholder}
        </Text>
        <Icon name="chevron-down" size={18} color={colors.onSurfaceSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Display size={type.lg}>Select State</Display>
              <Pressable testID="state-picker-close" onPress={() => setOpen(false)} hitSlop={8}>
                <Icon name="close" size={22} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={true}>
              {US_STATES.map((state) => (
                <Pressable
                  key={state}
                  testID={`state-${state.replace(/\s+/g, "-")}`}
                  onPress={() => pick(state)}
                  style={[styles.row, value === state && styles.rowActive]}
                >
                  <Txt weight={value === state ? "bold" : "regular"} color={value === state ? colors.brand : colors.onSurface}>
                    {state}
                  </Txt>
                  {value === state ? <Icon name="check" size={18} color={colors.brand} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  triggerText: { flex: 1, fontFamily: "Manrope", fontSize: type.lg, color: colors.onSurface },
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  sheet: { width: "100%", maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowActive: { backgroundColor: colors.brandTertiary, borderRadius: radius.md },
});
