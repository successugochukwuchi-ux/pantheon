import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'sepia' | 'ocean' | 'forest' | 'midnight' | 'sunset' | 'lavender' | 'custom';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  customColors: Record<string, string>;
  setCustomColors: (colors: Record<string, string>) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('pantheon-theme');
    return (saved as Theme) || 'light';
  });

  const [customColors, setCustomColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('pantheon-custom-colors');
    return saved ? JSON.parse(saved) : {
      primary: '#000000',
      background: '#ffffff',
      foreground: '#000000',
      accent: '#f1f5f9'
    };
  });

  useEffect(() => {
    localStorage.setItem('pantheon-theme', theme);
    localStorage.setItem('pantheon-custom-colors', JSON.stringify(customColors));
    
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'sepia', 'ocean', 'forest', 'midnight', 'sunset', 'lavender', 'custom');
    root.classList.add(theme);
    
    // Handle shadcn dark mode class
    if (theme === 'dark' || theme === 'midnight') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Apply custom colors if theme is 'custom'
    if (theme === 'custom') {
      Object.entries(customColors).forEach(([key, value]) => {
        // Simple hex to oklch/hsl conversion is complex, so we'll use hex directly for custom
        // but we need to ensure the CSS variables are set correctly
        root.style.setProperty(`--${key}`, value);
      });
    } else {
      // Clear inline styles when switching away from custom
      root.style.removeProperty('--primary');
      root.style.removeProperty('--background');
      root.style.removeProperty('--foreground');
      root.style.removeProperty('--accent');
    }
  }, [theme, customColors]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, customColors, setCustomColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
