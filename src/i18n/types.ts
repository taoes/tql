export type Locale = "zh-CN" | "zh-TW" | "en-US";

export const LOCALES: { value: Locale; label: string }[] = [
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "en-US", label: "English" },
];

export const DEFAULT_LOCALE: Locale = "zh-CN";

export type Dictionary = Record<string, unknown>;
