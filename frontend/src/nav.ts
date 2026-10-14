import { Platform, Linking } from "react-native";

// Go back if there is history; otherwise (e.g. a page opened directly or
// refreshed on web) fall back to the Market tab so users are never stuck.
export function goBack(router: { canGoBack: () => boolean; back: () => void; replace: (href: any) => void }) {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}

// Open a payment / onboarding URL (Stripe). Browsers silently block pop-ups
// that are opened after an async call, so on web we navigate the current tab;
// on iOS/Android we hand the URL to the system browser.
export async function openExternal(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.assign(url);
  } else {
    await Linking.openURL(url);
  }
}
