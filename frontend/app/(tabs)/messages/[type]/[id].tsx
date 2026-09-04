import React, { useCallback, useRef, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Txt, Display, Icon, Loader, Field } from "@/src/ui";
import { colors, spacing, radius, type } from "@/src/theme";

type Msg = { id: string; sender_id: string; sender_name: string; body: string; created_at: string };

export default function Thread() {
  const { type: contextType, id: contextId } = useLocalSearchParams<{ type: string; id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ messages: Msg[] }>(`/messages/${contextType}/${contextId}`);
      setMessages(res.messages);
    } catch (e: any) {
      setError(e.message || "Couldn't load this conversation");
    }
  }, [contextType, contextId]);

  useFocusEffect(useCallback(() => {
    load();
    const interval = setInterval(load, 5000); // simple polling, no websockets needed for now
    return () => clearInterval(interval);
  }, [load]));

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    setSending(true);
    try {
      await apiFetch(`/messages`, { method: "POST", body: { context_type: contextType, context_id: contextId, body } });
      await load();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setError(e.message || "Message failed to send");
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Display size={type.xl}>MESSAGES</Display>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={80}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1, justifyContent: "flex-end" }}
        ref={scrollRef as any}
      >
        {messages === null ? (
          <Loader />
        ) : messages.length === 0 ? (
          <View style={{ alignItems: "center", padding: spacing.xl }}>
            <Icon name="message-text-outline" size={32} color={colors.onSurfaceSecondary} />
            <Txt color={colors.onSurfaceSecondary} style={{ marginTop: spacing.sm }}>No messages yet — say hello.</Txt>
          </View>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <View key={m.id} style={[styles.bubbleRow, { justifyContent: mine ? "flex-end" : "flex-start" }]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {!mine ? <Txt size={type.sm} weight="bold" color={colors.brand}>{m.sender_name}</Txt> : null}
                  <Txt color={mine ? colors.onBrand : colors.onSurface}>{m.body}</Txt>
                </View>
              </View>
            );
          })
        )}
        {error ? <Txt color={colors.error} size={type.sm}>{error}</Txt> : null}
      </KeyboardAwareScrollView>

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Field placeholder="Type a message…" value={draft} onChangeText={setDraft} onSubmitEditing={send} returnKeyType="send" testID="message-input" />
        </View>
        <Pressable testID="send-btn" onPress={send} disabled={sending || !draft.trim()} style={[styles.sendBtn, (sending || !draft.trim()) && { opacity: 0.5 }]}>
          <Icon name="send" size={20} color={colors.onBrand} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  bubbleRow: { flexDirection: "row" },
  bubble: { maxWidth: "80%", borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 2 },
  bubbleMine: { backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surfaceSecondary, borderBottomLeftRadius: 4 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  sendBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
