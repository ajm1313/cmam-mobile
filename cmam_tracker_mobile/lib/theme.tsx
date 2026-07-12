import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'cmam_theme_preference';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  error: string;
  info: string;
  background: string;
  surface: string;
  surfaceSecondary: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  sam: string;
  mam: string;
  discharged: string;
  headerBg: string;
  headerText: string;
  inputBg: string;
  cardShadow: string;
}

export const LightColors: ThemeColors = {
  primary: '#1e3a8a',
  primaryLight: '#2563eb',
  primaryDark: '#1e293b',
  secondary: '#0891b2',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  error: '#dc2626',
  info: '#3b82f6',
  background: '#f0f4ff',
  surface: '#ffffff',
  surfaceSecondary: '#f8fafc',
  border: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  sam: '#dc2626',
  mam: '#d97706',
  discharged: '#16a34a',
  headerBg: '#1e3a8a',
  headerText: '#ffffff',
  inputBg: '#f8fafc',
  cardShadow: '#000',
};

export const DarkColors: ThemeColors = {
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  primaryDark: '#0f172a',
  secondary: '#22d3ee',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  error: '#ef4444',
  info: '#60a5fa',
  background: '#0f172a',
  surface: '#1e293b',
  surfaceSecondary: '#1a2332',
  border: '#334155',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  sam: '#ef4444',
  mam: '#f59e0b',
  discharged: '#22c55e',
  headerBg: '#0f172a',
  headerText: '#f1f5f9',
  inputBg: '#1a2332',
  cardShadow: '#000',
};

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  isDark: false,
  colors: LightColors,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
    });
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_KEY, newMode);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
