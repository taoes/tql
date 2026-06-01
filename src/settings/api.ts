import { invoke } from "@tauri-apps/api/core";
import { AppSettings, DEFAULT_SETTINGS } from "./types";

function mergeWithDefaults(partial: unknown): AppSettings {
  const source = (partial && typeof partial === "object" ? partial : {}) as Record<
    string,
    Record<string, unknown> | undefined
  >;
  const merged: Record<string, unknown> = {};
  (Object.keys(DEFAULT_SETTINGS) as Array<keyof AppSettings>).forEach((key) => {
    const defaults = DEFAULT_SETTINGS[key] as unknown as Record<string, unknown>;
    const override = source[key] ?? {};
    merged[key] = { ...defaults, ...override };
  });
  return merged as unknown as AppSettings;
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = await invoke<unknown>("load_settings");
  return mergeWithDefaults(raw);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await invoke("save_settings", { settings });
}
