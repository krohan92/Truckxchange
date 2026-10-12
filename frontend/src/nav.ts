// Go back if there is history; otherwise (e.g. a page opened directly or
// refreshed on web) fall back to the Market tab so users are never stuck.
export function goBack(router: { canGoBack: () => boolean; back: () => void; replace: (href: any) => void }) {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}
