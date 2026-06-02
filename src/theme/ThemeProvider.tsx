import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import { useSettings } from "../settings/SettingsContext";

// ============================================================
// ThemeProvider
//
// Reads settings.style.themeMode and applies the appropriate
// theme to the document root and antd ConfigProvider.
//
// - "light"  → remove .dark class, antd defaultAlgorithm
// - "dark"   → add .dark class, antd darkAlgorithm
// - "system" → follow OS preference via matchMedia,
//              with live listener for changes
// ============================================================

type ThemeMode = "light" | "dark" | "system";

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { settings } = useSettings();
  const themeMode: ThemeMode = settings?.style?.themeMode ?? "light";
  const [systemIsDark, setSystemIsDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  // ── Listen to OS theme changes ────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Resolve effective theme ───────────────────────────────
  const resolved = themeMode === "system"
    ? (systemIsDark ? "dark" : "light")
    : themeMode;

  // ── Apply .dark class to <html> ───────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  // ── antd theme algorithm ──────────────────────────────────
  const antdThemeConfig = useMemo(
    () => ({
      algorithm:
        resolved === "dark"
          ? antdTheme.darkAlgorithm
          : antdTheme.defaultAlgorithm,
    }),
    [resolved],
  );

  return (
    <ConfigProvider theme={antdThemeConfig}>
      {children}
    </ConfigProvider>
  );
}
