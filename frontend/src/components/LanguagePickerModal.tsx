import React, { useState } from "react";
import { Modal, View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { setLanguage, SupportedLanguage } from "@/src/i18n";
import { Txt, Display, Icon } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

const OPTIONS: { code: SupportedLanguage; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
];

export default function LanguagePickerModal({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const [picking, setPicking] = useState<SupportedLanguage | null>(null);

  const choose = async (code: SupportedLanguage) => {
    setPicking(code);
    await setLanguage(code);
    onDone();
  };

  // Dismissing without picking keeps whatever language is already active
  // (device default or English) and remembers that choice, so the popup
  // doesn't keep reappearing every time the app opens.
  const skip = async () => {
    await setLanguage((i18n.language as SupportedLanguage) || "en");
    onDone();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={skip}>
      <Pressable style={styles.backdrop} onPress={skip}>
        <Pressable style={[styles.sheet, { marginBottom: insets.bottom + spacing.xl }]} onPress={(e) => e.stopPropagation()}>
          <Pressable testID="lang-picker-skip" onPress={skip} style={styles.closeBtn} hitSlop={10}>
            <Icon name="close" size={18} color={colors.onSurfaceSecondary} />
          </Pressable>
          <View style={styles.iconWrap}>
            <Icon name="translate" size={26} color={colors.brand} />
          </View>
          <Display size={type.xl} style={{ textAlign: "center" }}>Choose your language</Display>
          <Txt color={colors.onSurfaceSecondary} style={{ textAlign: "center", marginBottom: spacing.sm }}>
            You can change this anytime in Profile.
          </Txt>
          {OPTIONS.map((opt) => (
            <Pressable
              key={opt.code}
              testID={`lang-picker-${opt.code}`}
              onPress={() => choose(opt.code)}
              disabled={picking !== null}
              style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
            >
              <Txt weight="bold" size={type.lg}>{opt.native}</Txt>
              {opt.native !== opt.label ? <Txt color={colors.onSurfaceSecondary} size={type.sm}>{opt.label}</Txt> : null}
            </Pressable>
          ))}
          <Pressable testID="lang-picker-skip-text" onPress={skip} style={{ alignSelf: "center", marginTop: 4 }}>
            <Txt color={colors.onSurfaceSecondary} size={type.sm}>Skip for now</Txt>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "flex-end" },
  sheet: { width: "100%", maxWidth: 420, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, alignItems: "stretch" },
  closeBtn: { position: "absolute", top: spacing.md, right: spacing.md, width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  iconWrap: { alignSelf: "center", width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  option: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
});
