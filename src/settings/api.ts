import { invoke } from "@tauri-apps/api/core";
import { AppSettings, DEFAULT_SETTINGS } from "./types";
import type { DataSourceConfig, DatasourceSettings } from "./types";

function mergeWithDefaults(partial: unknown): AppSettings {
  const source = (partial && typeof partial === "object" ? partial : {}) as Record<
    string,
    Record<string, unknown> | undefined
  >;
  const merged: Record<string, unknown> = {};
  (Object.keys(DEFAULT_SETTINGS) as Array<keyof AppSettings>).forEach((key) => {
    if (key === "datasource") {
      // Deep merge for nested datasource: { defaults, connections }
      const defaultDS = DEFAULT_SETTINGS.datasource as unknown as DatasourceSettings;
      const srcDS = (source.datasource ?? {}) as Record<string, unknown>;
      const srcDefaults = (srcDS.defaults ?? {}) as Record<string, unknown>;
      merged.datasource = {
        defaults: { ...defaultDS.defaults, ...srcDefaults },
        connections: (srcDS.connections as DataSourceConfig[]) ?? [],
      } satisfies DatasourceSettings;
    } else {
      const defaults = DEFAULT_SETTINGS[key] as unknown as Record<string, unknown>;
      const override = source[key] ?? {};
      merged[key] = { ...defaults, ...override };
    }
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
