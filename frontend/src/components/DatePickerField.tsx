import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { colors, spacing, radius, type } from "@/src/theme";
import { Txt, Display, Icon } from "@/src/ui";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDate(d: Date): string {
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function DatePickerField({
  label,
  value,
  onChange,
  minDate,
  placeholder = "Select date",
  testID,
}: {
  label?: string;
  value: Date | null;
  onChange: (d: Date) => void;
  minDate?: Date | null;
  placeholder?: string;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = value || minDate || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const openPicker = () => {
    const base = value || minDate || new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setOpen(true);
  };

  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const min = minDate ? startOfDay(minDate) : null;

  const pick = (day: number) => {
    const picked = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    onChange(picked);
    setOpen(false);
  };

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Txt size={type.sm} color={colors.onSurfaceSecondary} weight="medium">{label}</Txt> : null}
      <Pressable testID={testID} onPress={openPicker} style={styles.trigger}>
        <Icon name="calendar-month-outline" size={18} color={colors.onSurfaceSecondary} />
        <Text style={[styles.triggerText, !value && { color: colors.onSurfaceSecondary }]}>
          {value ? formatDate(value) : placeholder}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.calHeader}>
              <Pressable
                testID="cal-prev"
                onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                style={styles.navBtn}
              >
                <Icon name="chevron-left" size={22} color={colors.onSurface} />
              </Pressable>
              <Display size={type.lg}>{MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}</Display>
              <Pressable
                testID="cal-next"
                onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                style={styles.navBtn}
              >
                <Icon name="chevron-right" size={22} color={colors.onSurface} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w, i) => (
                <View key={i} style={styles.dayCell}><Txt size={type.sm} color={colors.onSurfaceSecondary} weight="bold">{w}</Txt></View>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (day === null) return <View key={i} style={styles.dayCell} />;
                const thisDate = startOfDay(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
                const disabled = min ? thisDate < min : false;
                const selected = value ? sameDay(thisDate, value) : false;
                const isToday = sameDay(thisDate, startOfDay(new Date()));
                return (
                  <Pressable
                    key={i}
                    testID={`cal-day-${day}`}
                    disabled={disabled}
                    onPress={() => pick(day)}
                    style={[styles.dayCell, styles.dayTouchable, selected && styles.daySelected]}
                  >
                    <Txt
                      size={type.base}
                      weight={selected ? "bold" : "regular"}
                      color={disabled ? colors.onSurfaceSecondary : selected ? colors.onBrand : isToday ? colors.brand : colors.onSurface}
                      style={disabled ? { opacity: 0.35 } : undefined}
                    >
                      {day}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>

            <Pressable testID="cal-close" onPress={() => setOpen(false)} style={styles.closeBtn}>
              <Txt weight="bold" color={colors.onSurfaceSecondary}>Cancel</Txt>
            </Pressable>
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
  triggerText: { fontFamily: "Manrope", fontSize: type.lg, color: colors.onSurface },
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  sheet: { width: "100%", maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  navBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  weekRow: { flexDirection: "row" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayTouchable: { borderRadius: radius.pill },
  daySelected: { backgroundColor: colors.brand },
  closeBtn: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
});
