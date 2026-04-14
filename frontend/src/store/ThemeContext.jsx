/**
 * BidBlitz V2 - Theme Context
 * Dark/Light Mode mit CSS-Variablen und localStorage Persistenz
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

const DARK_VARS = {
  "--bg-primary": "#0A0A0F",
  "--bg-secondary": "#111118",
  "--bg-card": "#111118",
  "--bg-input": "rgba(255,255,255,0.05)",
  "--border-color": "rgba(255,255,255,0.05)",
  "--border-hover": "rgba(255,255,255,0.1)",
  "--text-primary": "#FFFFFF",
  "--text-secondary": "rgba(255,255,255,0.7)",
  "--text-muted": "rgba(255,255,255,0.4)",
  "--text-dim": "rgba(255,255,255,0.2)",
  "--shadow": "none",
};

const LIGHT_VARS = {
  "--bg-primary": "#F8F9FB",
  "--bg-secondary": "#FFFFFF",
  "--bg-card": "#FFFFFF",
  "--bg-input": "#F1F3F5",
  "--border-color": "#E8EBF0",
  "--border-hover": "#D1D5DB",
  "--text-primary": "#111827",
  "--text-secondary": "#4B5563",
  "--text-muted": "#9CA3AF",
  "--text-dim": "#D1D5DB",
  "--shadow": "0 1px 3px rgba(0,0,0,0.08)",
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("bidblitz_theme");
    return saved ? saved === "dark" : true; // Default dark
  });

  const applyTheme = useCallback((dark) => {
    const vars = dark ? DARK_VARS : LIGHT_VARS;
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
    root.classList.toggle("light-mode", !dark);
    root.classList.toggle("dark-mode", dark);
  }, []);

  useEffect(() => {
    applyTheme(isDark);
    localStorage.setItem("bidblitz_theme", isDark ? "dark" : "light");
  }, [isDark, applyTheme]);

  const toggle = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggle, setDark: setIsDark }}>
      {children}
    </ThemeContext.Provider>
  );
};
