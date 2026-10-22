import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
type Theme = "light" | "dark" | "system";
const KEY = "bidbridge.theme.v1";
function readTheme(): Theme { try { const value = localStorage.getItem(KEY); return value === "light" || value === "dark" ? value : "system"; } catch { return "system"; } }
const ThemeContext = createContext({ dark: false, toggle: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Theme>(readTheme);
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  const dark = preference === "dark" || (preference === "system" && systemDark);
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const change = () => setSystemDark(query.matches);
    const storage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) setPreference(readTheme()); };
    query.addEventListener("change", change); window.addEventListener("storage", storage);
    return () => { query.removeEventListener("change", change); window.removeEventListener("storage", storage); };
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
  const toggle = () => { const next = dark ? "light" : "dark"; setPreference(next); try { localStorage.setItem(KEY, next); } catch { /* Theme remains usable for this tab. */ } };
  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}
export function ThemeToggle() {
  const { dark, toggle } = useContext(ThemeContext);
  return <button className="theme-toggle" type="button" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}><span aria-hidden="true">{dark ? "☀" : "☾"}</span><span>{dark ? "Light" : "Dark"}</span></button>;
}
