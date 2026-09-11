import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import { storage } from "@/src/utils/storage";

import en from "./locales/en.json";
import es from "./locales/es.json";
import pa from "./locales/pa.json";

export const SUPPORTED_LANGUAGES = ["en", "es", "pa"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const resources = {
  en: { translation: en },
  es: { translation: es },
  pa: { translation: pa },
};

function deviceDefaultLanguage(): SupportedLanguage {
  const code = Localization.getLocales()[0]?.languageCode;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code || "") ? (code as SupportedLanguage) : "en";
}

i18n.use(initReactI18next).init({
  resources,
  lng: "en", // set for real just below, once the saved preference loads
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

// Loads the driver's saved language choice (if any) once on app start.
// Falls back to the device's own language if it's one we support, else English.
// Returns whether this was a first-ever launch (no saved preference), so the
// caller can show a one-time language picker.
export async function initLanguage(): Promise<{ isFirstLaunch: boolean }> {
  const saved = await storage.getItem<SupportedLanguage | null>("language", null);
  const lang = saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved) ? saved : deviceDefaultLanguage();
  await i18n.changeLanguage(lang);
  return { isFirstLaunch: !saved };
}

export async function setLanguage(lang: SupportedLanguage) {
  await i18n.changeLanguage(lang);
  await storage.setItem("language", lang);
}

export default i18n;
