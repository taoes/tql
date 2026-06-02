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
//
// Also applies settings.style.themeColor as antd's
// colorPrimary seed token, which auto-generates the full
// color palette (see https://ant.design/docs/spec/colors).
// ============================================================

type ThemeMode = "light" | "dark" | "system";
type ThemeColor = "blue" | "green" | "purple" | "orange";

/** antd 5 preset primary color values */
const PRIMARY_COLORS: Record<ThemeColor, string> = {
  blue:   "#1677ff",
  green:  "#52c41a",
  purple: "#722ed1",
  orange: "#fa8c16",
};

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { settings } = useSettings();
  const themeMode: ThemeMode = settings?.style?.themeMode ?? "light";
  const themeColor: ThemeColor = settings?.style?.themeColor ?? "blue";

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

  // ── Apply theme color CSS custom properties ───────────────
  useEffect(() => {
    const root = document.documentElement;
    const primary = PRIMARY_COLORS[themeColor];
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--ring", primary);
    // Also set chart-1 for consistency with the color system
    root.style.setProperty("--chart-1", primary);
  }, [themeColor]);

  // ── antd theme config (algorithm + color token) ───────────
  const antdThemeConfig = useMemo(
    () => ({
      algorithm:
        resolved === "dark"
          ? antdTheme.darkAlgorithm
          : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: PRIMARY_COLORS[themeColor],
      },
    }),
    [resolved, themeColor],
  );

  return (
    <ConfigProvider theme={antdThemeConfig}>
      {children}
    </ConfigProvider>
  );
}
