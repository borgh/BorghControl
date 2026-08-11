import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "esmeralda" | "escuro" | "azul" | "roxo" | "laranja";

export const THEME_OPTIONS: { key: Theme; label: string; description: string; swatchBg: string; swatchPrimary: string; dark?: boolean }[] = [
  { key: "esmeralda", label: "Esmeralda", description: "Tema padrão do sistema", swatchBg: "#f4f8f5", swatchPrimary: "#006c36" },
  { key: "escuro", label: "Escuro", description: "Fundo escuro, ideal para ambientes com pouca luz", swatchBg: "#0e171e", swatchPrimary: "#00a461", dark: true },
  { key: "azul", label: "Oceano", description: "Tons de azul", swatchBg: "#f4f7fa", swatchPrimary: "#006ab4" },
  { key: "roxo", label: "Ametista", description: "Tons de roxo", swatchBg: "#f7f6fa", swatchPrimary: "#6f3bb2" },
  { key: "laranja", label: "Pôr do Sol", description: "Tons de laranja", swatchBg: "#fbf6f1", swatchPrimary: "#d64d00" },
];

const THEME_KEY = "borghcontrol-theme";
const THEME_KEYS = THEME_OPTIONS.map((t) => t.key);
const THEME_CLASSES = ["dark", "theme-azul", "theme-roxo", "theme-laranja"];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);
  if (theme === "escuro") root.classList.add("dark");
  else if (theme !== "esmeralda") root.classList.add(`theme-${theme}`);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    return (stored && (THEME_KEYS as string[]).includes(stored)) ? (stored as Theme) : "esmeralda";
  });

  // Aplica a classe do tema o quanto antes (evita "flash" do tema padrão)
  useEffect(() => {
    applyThemeClass(theme);
  }, []);

  useEffect(() => {
    applyThemeClass(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
