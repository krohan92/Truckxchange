import React, { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { apiFetch } from "@/src/api/client";
import { Icon, Txt } from "@/src/ui";
import { colors, radius } from "@/src/theme";

export default function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      apiFetch<{ count: number }>("/notifications/unread-count")
        .then((r) => alive && setCount(r.count))
        .catch(() => {});
      return () => { alive = false; };
    }, [])
  );

  return (
    <Pressable testID="notif-bell" onPress={() => router.push("/notifications")} hitSlop={10} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
      <Icon name="bell-outline" size={24} color={colors.onSurface} />
      {count > 0 ? (
        <View style={{ position: "absolute", top: 4, right: 4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface }}>
          <Txt size={10} weight="bold" color={colors.onBrand}>{count > 9 ? "9+" : count}</Txt>
        </View>
      ) : null}
    </Pressable>
  );
}
