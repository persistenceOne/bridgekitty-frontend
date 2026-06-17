import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'bk-theme';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Resolves the initial theme synchronously so the very first paint already
 * carries the right `data-theme` and we avoid a light→dark flash. Precedence:
 * explicit user choice in localStorage → OS `prefers-color-scheme` → light.
 */
function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* localStorage can throw in private mode — fall through to system pref */
  }
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
}

/**
 * Briefly enables the global `.theme-transition` crossfade (see index.css),
 * flips the theme, then removes the class so per-component transitions keep
 * their own timing. Guarded so overlapping toggles don't strand the class.
 */
let transitionTimer: ReturnType<typeof setTimeout> | null = null;
function enableTransitionWindow() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('theme-transition');
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    root.classList.remove('theme-transition');
    transitionTimer = null;
  }, 340);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(resolveInitialTheme);
  const firstRun = useRef(true);

  // Reflect the active theme onto <html> whenever it changes. The first run
  // (mount) just applies it; subsequent changes also fire the crossfade so
  // the light↔dark switch animates smoothly instead of snapping.
  useEffect(() => {
    applyTheme(theme);
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    enableTransitionWindow();
  }, [theme]);

  // Follow OS changes only while the user hasn't pinned an explicit choice.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      let hasExplicit = false;
      try {
        hasExplicit = !!window.localStorage.getItem(STORAGE_KEY);
      } catch {
        hasExplicit = false;
      }
      if (!hasExplicit) setThemeState(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore persistence failures (private mode) */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
