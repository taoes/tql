import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { AppSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { loadSettings, saveSettings } from "./api";
import { useTranslation } from "../i18n";
import { enable, disable } from "@tauri-apps/plugin-autostart";
import { invoke } from "@tauri-apps/api/core";
import { syncTrayMenu } from "../db-api";

// ============================================================
// Settings Context
//
// Loads settings once on mount and provides them app-wide.
// Also exposes a save function that persists and updates state.
// ============================================================

interface SettingsContextValue {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  /** Save settings to disk and update context state */
  save: (next: AppSettings) => Promise<void>;
  /** Reload settings from disk */
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const t = useTranslation();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await loadSettings();
      setSettings(s);

      // Sync OS autostart on initial load
      try {
        if (s.general.autoStart) {
          await enable();
        } else {
          await disable();
        }
      } catch {
        // autostart may not be available on all platforms
      }

      // Sync minimize-to-tray flag with Rust backend
      try {
        await invoke("set_minimize_to_tray", {
          enabled: s.general.minimizeToTray,
        });
      } catch {
        // backend may not be available in dev mode
      }

      // Sync tray menu labels with Rust backend
      try {
        await syncTrayMenu(s.general.language);
      } catch {
        // backend may not be available in dev mode
      }
    } catch (e) {
      // Fall back to defaults so the app remains functional
      // even when Tauri backend is unavailable (e.g. Vite dev mode)
      setSettings(DEFAULT_SETTINGS);
      setError(t("settings.loadFailed", { error: String(e) }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const save = useCallback(
    async (next: AppSettings) => {
      await saveSettings(next);
      setSettings(next);

      // Sync OS-level autostart with the persisted setting
      try {
        if (next.general.autoStart) {
          await enable();
        } else {
          await disable();
        }
      } catch {
        // autostart plugin may not be available on all platforms
      }

      // Sync minimize-to-tray flag with Rust backend
      try {
        await invoke("set_minimize_to_tray", {
          enabled: next.general.minimizeToTray,
        });
      } catch {
        // backend may not be available in dev mode
      }

      // Sync tray menu labels with Rust backend
      try {
        await syncTrayMenu(next.general.language);
      } catch {
        // backend may not be available in dev mode
      }
    },
    [],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <SettingsContext.Provider value={{ settings, loading, error, save, reload }}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Access the full settings context.
 * Throws if used outside <SettingsProvider>.
 */
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within <SettingsProvider>");
  }
  return ctx;
}

/**
 * Convenience hook: extracts the currently active model config
 * for the AI service. Falls back to DEFAULT_SETTINGS while settings
 * are loading or on error.
 */
export function useModelConfig() {
  const { settings } = useSettings();
  const aiModels = settings?.aiModels ?? DEFAULT_SETTINGS.aiModels;
  const active =
    aiModels.models.find((m) => m.id === aiModels.activeModelId) ??
    aiModels.models[0];
  if (!active) return null;
  return {
    provider: active.provider,
    apiUrl: active.apiUrl,
    apiKey: active.apiKey,
    model: active.modelName,
    temperature: active.temperature,
    maxTokens: active.maxTokens,
    topP: active.topP,
  };
}
