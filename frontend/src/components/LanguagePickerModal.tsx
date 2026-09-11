import React, { useState } from "react";
import { Modal, View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const [picking, setPicking] = useState<SupportedLanguage | null>(null);

  const choose = async (code: SupportedLanguage) => {
    setPicking(code);
    await setLanguage(code);
    onDone();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { marginBottom: insets.bottom + spacing.xl }]}>
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "flex-end" },
  sheet: { width: "100%", maxWidth: 420, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, alignItems: "stretch" },
  iconWrap: { alignSelf: "center", width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  option: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
});
