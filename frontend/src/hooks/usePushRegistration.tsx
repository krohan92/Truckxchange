import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Registers this device for push notifications once a user is logged in.
// Renders nothing — mount it once near the top of the app.
export function PushRegistrar() {
  const { user } = useAuth();
  const router = useRouter();

  // Tapping any notification (a push from the backend, or a local geofence
  // alert) routes to the relevant screen instead of just opening the app.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data: any = response.notification.request.content.data || {};
      try {
        if (data.bookingId) router.push(`/booking/${data.bookingId}`);
        else if (data.booking_id) router.push(`/booking/${data.booking_id}`);
        else if (data.context_type && data.context_id) router.push(`/messages/${data.context_type}/${data.context_id}`);
      } catch {
        // Navigation can fail if the router isn't ready yet — safe to ignore.
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!user || Platform.OS === "web") return; // Expo push tokens don't apply on web

    (async () => {
      try {
        if (!Device.isDevice) return; // simulators/emulators can't get a real push token

        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== "granted") {
          const req = await Notifications.requestPermissionsAsync();
          status = req.status;
        }
        if (status !== "granted") return;

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const tokenData = await Notifications.getExpoPushTokenAsync();
        await apiFetch("/push/register", { method: "POST", body: { token: tokenData.data } });
      } catch (e) {
        // Best-effort — push registration should never block the app.
        console.log("push registration skipped:", e);
      }
    })();
  }, [user?.id]);

  return null;
}
