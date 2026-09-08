import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const GEOFENCE_TASK = "rigrent-booking-geofence";
const RADIUS_METERS = 200;

type BookingForGeofence = {
  id: string;
  status: string;
  listing_title: string;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  return_latitude?: number | null;
  return_longitude?: number | null;
};

// Defined at module scope (required by TaskManager) — fires whenever the
// device enters or exits a registered region, even if the app is backgrounded.
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
  if (error) return;
  const { eventType, region } = data || {};
  if (eventType !== Location.GeofencingEventType.Enter || !region?.identifier) return;

  const [bookingId, phase] = String(region.identifier).split(":");
  if (!bookingId || !phase) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: phase === "pickup" ? "You've arrived" : "Looks like you're back",
        body:
          phase === "pickup"
            ? "Ready to start your trip? Open RigRent to check in."
            : "Log your return inspection to complete this trip.",
        data: { bookingId, phase, type: "geofence" },
      },
      trigger: null, // fire immediately
    });
  } catch {
    // Best-effort — never crash the background task.
  }
});

// Call this whenever the renter's booking list loads or changes. It rebuilds
// the full geofence region list from scratch each time (the underlying API
// replaces, rather than appends, on every call).
export async function syncGeofences(bookings: BookingForGeofence[]) {
  if (Platform.OS === "web") return; // geofencing doesn't apply on web

  try {
    const { status: fg } = await Location.getForegroundPermissionsAsync();
    if (fg !== "granted") return;
    const { status: bg } = await Location.getBackgroundPermissionsAsync();
    if (bg !== "granted") return;

    const regions: Location.LocationRegion[] = [];
    for (const b of bookings) {
      if (b.status === "approved" && b.pickup_latitude != null && b.pickup_longitude != null) {
        regions.push({
          identifier: `${b.id}:pickup`,
          latitude: b.pickup_latitude,
          longitude: b.pickup_longitude,
          radius: RADIUS_METERS,
          notifyOnEnter: true,
          notifyOnExit: false,
        });
      }
      if (b.status === "active" && b.return_latitude != null && b.return_longitude != null) {
        regions.push({
          identifier: `${b.id}:return`,
          latitude: b.return_latitude,
          longitude: b.return_longitude,
          radius: RADIUS_METERS,
          notifyOnEnter: true,
          notifyOnExit: false,
        });
      }
    }

    if (regions.length === 0) {
      const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false);
      if (isRunning) await Location.stopGeofencingAsync(GEOFENCE_TASK);
      return;
    }
    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
  } catch {
    // Geofencing is a nice-to-have — never let it block the app.
  }
}

// Ask for "always" location, needed for geofencing to fire in the background.
// Call this once, e.g. when a renter's booking first becomes approved.
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.status === "granted";
}
