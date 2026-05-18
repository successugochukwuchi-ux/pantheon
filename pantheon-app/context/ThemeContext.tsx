import React, { createContext, useContext, ReactNode } from 'react';
import { THEMES, ThemeName } from '../components/Theme';
import { useAuth } from './AuthContext';

interface ThemeContextType {
  colors: typeof THEMES.light;
  themeName: ThemeName;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  
  // Default to light if theme not set or not found
  const themeName = (profile?.theme as ThemeName) || 'light';
  const colors = THEMES[themeName] || THEMES.light;

  return (
    <ThemeContext.Provider value={{ colors, themeName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
