'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('yieldflow-theme') as 'dark' | 'light' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
      if (saved === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
      }
    } else {
      // Default to light mode for crisp commercial presentation if not saved
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.add('light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('yieldflow-theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  };

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-xl border border-border bg-background-card/80 flex items-center justify-center animate-pulse" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to Crisp Light Mode' : 'Switch to Dark Mode'}
      className="relative flex h-9.5 items-center gap-2 rounded-xl border border-border bg-background-card px-3 py-1.5 text-xs font-bold text-foreground shadow-md transition-all hover:border-border-hover hover:shadow-lg active:scale-95 group"
    >
      <div className="relative flex h-5 w-5 items-center justify-center">
        {theme === 'dark' ? (
          <Sun size={17} className="text-amber-400 rotate-0 scale-100 transition-all duration-300 group-hover:rotate-45" />
        ) : (
          <Moon size={17} className="text-blue-600 rotate-0 scale-100 transition-all duration-300 group-hover:-rotate-12" />
        )}
      </div>
      <span className="hidden sm:inline-block font-semibold">
        {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
      </span>
    </button>
  );
}
