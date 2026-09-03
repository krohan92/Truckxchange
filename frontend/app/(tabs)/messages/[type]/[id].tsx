import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/api/client";
import { Txt, Display, Icon, Loader, Badge } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

type Thread = {
  context_type: "booking" | "request";
  context_id: string;
  title: string;
  with_name: string;
  last_message: string;
  last_at: string;
  unread: number;
};

export default function Messages() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [threads, setThreads] = useState<Thread[] | null>(null);

  useFocusEffect(useCallback(() => {
    apiFetch<{ threads: Thread[] }>("/messages/threads").then((r) => setThreads(r.threads)).catch(() => setThreads([]));
  }, []));

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <Display size={type.xxl} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>MESSAGES</Display>
      {threads === null ? (
        <Loader />
      ) : threads.length === 0 ? (
        <View style={{ alignItems: "center", padding: spacing.xxl }}>
          <Icon name="message-outline" size={36} color={colors.onSurfaceSecondary} />
          <Txt color={colors.onSurfaceSecondary} style={{ marginTop: spacing.sm }}>No conversations yet.</Txt>
          <Txt color={colors.onSurfaceSecondary} size={type.sm} style={{ marginTop: 4 }}>Message threads open once you have a booking or roadside job.</Txt>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => `${t.context_type}-${t.context_id}`}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl }}
          renderItem={({ item }) => (
            <Pressable
              testID={`thread-${item.context_type}-${item.context_id}`}
              onPress={() => router.push(`/messages/${item.context_type}/${item.context_id}`)}
              style={styles.row}
            >
              <View style={styles.iconWrap}>
                <Icon name={item.context_type === "booking" ? "truck" : "wrench"} size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Txt weight="bold" numberOfLines={1} style={{ flex: 1 }}>{item.title}</Txt>
                  {item.unread > 0 ? <Badge label={`${item.unread}`} tone="brand" /> : null}
                </View>
                <Txt size={type.sm} color={colors.onSurfaceSecondary} numberOfLines={1}>{item.with_name}: {item.last_message}</Txt>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  iconWrap: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
});
