import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export type ThemeMode = "system" | "light" | "dark";
const KEY = "studydeck-theme";

function initialTheme(): ThemeMode {
  const saved = localStorage.getItem(KEY);
  return saved === "dark" || saved === "light" ? saved : "system";
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function applyTheme() {
      const actual =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = actual;
      document.documentElement.style.colorScheme = actual;
      // The macOS title bar draws the NSWindow background, not the CSS body.
      // Synchronize both native window color and appearance on every change.
      const window = getCurrentWebviewWindow();
      void window
        .setBackgroundColor(actual === "dark" ? "#15171B" : "#F7F8FA")
        .catch((error) => console.error("Native Fensterfarbe:", error));
      void window
        .setTheme(actual)
        .catch((error) => console.error("Natives Fensterthema:", error));
    }
    localStorage.setItem(KEY, theme);
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);
  return { theme, setTheme };
}
