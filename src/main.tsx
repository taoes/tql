import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { I18nProvider, DEFAULT_LOCALE, Locale } from "./i18n";
import { loadSettings } from "./settings/api";

async function bootstrap() {
  let initialLocale: Locale = DEFAULT_LOCALE;
  try {
    const settings = await loadSettings();
    initialLocale = settings.general.language;
  } catch {
    // fall back to default locale if settings can't be loaded
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <I18nProvider initialLocale={initialLocale}>
        <App />
      </I18nProvider>
    </React.StrictMode>
  );
}

bootstrap();
