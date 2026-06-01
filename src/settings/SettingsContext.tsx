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
 * Convenience hook: extracts just the model config for the AI service.
 * Falls back to DEFAULT_SETTINGS while settings are loading or on error,
 * so the AI service is always available.
 */
export function useModelConfig() {
  const { settings } = useSettings();
  const m = settings?.model ?? DEFAULT_SETTINGS.model;
  return {
    provider: m.provider,
    apiUrl: m.apiUrl,
    apiKey: m.apiKey,
    model: m.modelName,
    temperature: m.temperature,
    maxTokens: m.maxTokens,
    topP: m.topP,
  };
}
