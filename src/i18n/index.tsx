import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import { ConfigProvider } from "antd";
import type { Locale as AntdLocale } from "antd/es/locale";
import zhCN from "antd/locale/zh_CN";
import zhTW from "antd/locale/zh_TW";
import enUS from "antd/locale/en_US";
import { DEFAULT_LOCALE, Locale } from "./types";
import zhCNMessages, { Messages } from "./locales/zh-CN";
import zhTWMessages from "./locales/zh-TW";
import enUSMessages from "./locales/en-US";

export { LOCALES, DEFAULT_LOCALE } from "./types";
export type { Locale } from "./types";

const DICTS: Record<Locale, Messages> = {
  "zh-CN": zhCNMessages,
  "zh-TW": zhTWMessages,
  "en-US": enUSMessages,
};

const ANTD_LOCALES: Record<Locale, AntdLocale> = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  "en-US": enUS,
};

type Vars = Record<string, string | number>;

function resolve(dict: Messages, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Vars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale = DEFAULT_LOCALE }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const dict = DICTS[locale];
      const fromDict = resolve(dict, key);
      if (fromDict !== undefined) return interpolate(fromDict, vars);
      const fromFallback = resolve(DICTS["en-US"], key);
      if (fromFallback !== undefined) return interpolate(fromFallback, vars);
      return key;
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <I18nContext.Provider value={value}>
      <ConfigProvider locale={ANTD_LOCALES[locale]}>{children}</ConfigProvider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export function useTranslation() {
  return useI18n().t;
}
