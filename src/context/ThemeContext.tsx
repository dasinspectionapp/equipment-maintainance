import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  card: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;
  
  // Primary colors (BESCOM blue)
  primary: string;
  primaryDark: string;
  primaryLight: string;
  
  // Accent colors
  accent: string;
  accentDark: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Border colors
  border: string;
  borderLight: string;
  
  // Overlay colors
  overlay: string;
  backdrop: string;
  
  // Input colors
  inputBackground: string;
  inputBorder: string;
  placeholder: string;
  
  // Icon colors
  icon: string;
  iconSecondary: string;
}

const lightTheme: ThemeColors = {
  background: '#f1f5fb',
  surface: '#ffffff',
  card: '#ffffff',
  
  text: '#1a1a1a',
  textSecondary: '#4a5568',
  textMuted: '#718096',
  
  primary: '#005aa9',
  primaryDark: '#003b73',
  primaryLight: '#0078d4',
  
  accent: '#10b981',
  accentDark: '#059669',
  
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  
  overlay: 'rgba(255, 255, 255, 0.95)',
  backdrop: 'rgba(0, 0, 0, 0.5)',
  
  inputBackground: '#ffffff',
  inputBorder: '#e5e7eb',
  placeholder: '#9ca3af',
  
  icon: '#4a5568',
  iconSecondary: '#718096',
};

const darkTheme: ThemeColors = {
  background: '#0f172a',
  surface: '#1e293b',
  card: '#334155',
  
  text: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  primaryLight: '#60a5fa',
  
  accent: '#10b981',
  accentDark: '#059669',
  
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  border: '#334155',
  borderLight: '#475569',
  
  overlay: 'rgba(30, 41, 59, 0.95)',
  backdrop: 'rgba(0, 0, 0, 0.7)',
  
  inputBackground: '#1e293b',
  inputBorder: '#475569',
  placeholder: '#64748b',
  
  icon: '#cbd5e1',
  iconSecondary: '#94a3b8',
};

interface ThemeContextType {
  theme: ThemeColors;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');
  const [isDark, setIsDark] = useState(false);

  // Load saved theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('themeMode') as ThemeMode | null;
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto')) {
      setThemeModeState(savedTheme);
    }
  }, []);

  // Determine if dark mode should be active
  useEffect(() => {
    const updateTheme = () => {
      if (themeMode === 'auto') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDark(systemPrefersDark);
      } else {
        setIsDark(themeMode === 'dark');
      }
    };

    updateTheme();

    if (themeMode === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const setThemeMode = (mode: ThemeMode) => {
    localStorage.setItem('themeMode', mode);
    setThemeModeState(mode);
  };

  const toggleTheme = () => {
    const newMode = isDark ? 'light' : 'dark';
    setThemeMode(newMode);
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, themeMode, isDark, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

