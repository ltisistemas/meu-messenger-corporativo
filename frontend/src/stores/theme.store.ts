import { create } from 'zustand';

export type Theme = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('corpchat_theme') as Theme | null;
  if (stored && ['dark', 'light', 'system'].includes(stored)) return stored;
  return 'dark'; // Dark theme default for modern SaaS
}

function applyThemeToDom(theme: Theme): boolean {
  if (typeof window === 'undefined') return true;

  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  localStorage.setItem('corpchat_theme', theme);
  return isDark;
}

const initialTheme = getInitialTheme();
const initialIsDark = applyThemeToDom(initialTheme);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  isDark: initialIsDark,
  setTheme: (theme) => {
    const isDark = applyThemeToDom(theme);
    set({ theme, isDark });
  },
  toggleTheme: () => {
    set((state) => {
      const nextTheme = state.isDark ? 'light' : 'dark';
      const isDark = applyThemeToDom(nextTheme);
      return { theme: nextTheme, isDark };
    });
  },
}));
