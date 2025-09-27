"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../state/store";
import type { Theme } from "../state/types";

const THEME_STORAGE_KEY = "video-editor-theme";
const BUTTON_MIN_WIDTH_CLASS = "min-w-[160px]";

const themeIcons: Record<Theme, JSX.Element> = {
  light: (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M12 4.25a1 1 0 0 1-1-1V2a1 1 0 1 1 2 0v1.25a1 1 0 0 1-1 1Zm6.364 2.386a1 1 0 0 1-1.414-1.414l.884-.884a1 1 0 1 1 1.414 1.414zm3.386 5.364a1 1 0 0 1-1 1H19.5a1 1 0 0 1 0-2h1.25a1 1 0 0 1 1 1Zm-3.386 6.364-.884-.884a1 1 0 0 1 1.414-1.414l.884.884a1 1 0 1 1-1.414 1.414ZM12 19.75a1 1 0 0 1 1 1V22a1 1 0 1 1-2 0v-1.25a1 1 0 0 1 1-1Zm-7.364-2.386a1 1 0 0 1 1.414-1.414l.884.884a1 1 0 1 1-1.414 1.414zm-3.386-5.364a1 1 0 0 1 1-1H4.5a1 1 0 0 1 0 2H3.25a1 1 0 0 1-1-1Zm3.386-6.364.884.884A1 1 0 0 1 3.122 8.23l-.884-.884a1 1 0 1 1 1.414-1.414ZM12 7.25a4.75 4.75 0 1 1 0 9.5 4.75 4.75 0 0 1 0-9.5Z"
      />
    </svg>
  ),
  dark: (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M20.742 15.447a8.25 8.25 0 0 1-12.19-10.9 1 1 0 0 0-1.232-1.451A9.75 9.75 0 1 0 21.8 16.68a1 1 0 0 0-1.058-1.233Z"
      />
    </svg>
  ),
};

export function ThemeWatcher() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current || typeof window === "undefined") {
      return;
    }
    isInitialized.current = true;

    let preferred: Theme | null = null;
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        preferred = stored;
      }
    } catch {
      preferred = null;
    }

    if (!preferred) {
      const prefersDark =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      preferred = prefersDark ? "dark" : "light";
    }

    if (preferred !== theme) {
      setTheme(preferred);
    }
  }, [setTheme, theme]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
    root.style.setProperty("color-scheme", theme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore write failures
    }
  }, [theme]);

  return null;
}

export function ThemeToggle() {
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const label = useMemo(() => (theme === "dark" ? "Light mode" : "Dark mode"), [theme]);

  if (!isMounted) {
    return <div className={`${BUTTON_MIN_WIDTH_CLASS} h-9`} aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${BUTTON_MIN_WIDTH_CLASS}`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <span aria-hidden className="flex items-center gap-2">
        {themeIcons[theme === "dark" ? "light" : "dark"]}
        <span className="whitespace-nowrap">{label}</span>
      </span>
    </button>
  );
}
