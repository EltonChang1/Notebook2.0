import i18n from "i18next";
import { initReactI18next } from "react-i18next";

void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        appName: "Notebook 2.0",
        searchPlaceholder: "Search problems, books, events, notes...",
        settings: "Settings",
      },
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
