import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

const REPORT_INTERVAL_MS = 60_000; // every 60s while the app is open and foregrounded

// Reports a driver's live GPS position to the backend while the app is open
// (foreground only — no background task, no Google location service). Stored
// in MongoDB with a 2dsphere index so owners can sort/filter available
// drivers by real distance, same approach already used for "near me" listing
// search. Only reports for renters who've actually set up a driver profile —
// a plain renter just renting trucks is never tracked.
// Renders nothing — mount it once near the top of the app, alongside
// PushRegistrar.
export function DriverLocationReporter() {
  const { user } = useAuth();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDriver = !!user && user.role === "renter" && !!user.driver_profile;

  useEffect(() => {
    if (!isDriver) return;

    let cancelled = false;

    const reportOnce = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        let granted = status === "granted";
        if (!granted) {
          const req = await Location.requestForegroundPermissionsAsync();
          granted = req.status === "granted";
        }
        if (!granted || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        await apiFetch("/driver-profile/location", {
          method: "POST",
          body: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        });
      } catch (e) {
        // Best-effort — a failed location ping should never surface to the user.
        console.log("driver location report skipped:", e);
      }
    };

    reportOnce();
    timerRef.current = setInterval(reportOnce, REPORT_INTERVAL_MS);

    // Also report immediately whenever the app comes back to the foreground,
    // rather than waiting for the next interval tick.
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") reportOnce();
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      sub.remove();
    };
  }, [isDriver]);

  return null;
}
