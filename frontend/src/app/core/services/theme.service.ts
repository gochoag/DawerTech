import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'dawertech-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal<boolean>(false);

  constructor() {
    this.initTheme();
  }

  private initTheme(): void {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(THEME_KEY);
    // Explicit rule: Light mode is default unless user explicitly chose dark
    if (saved === 'dark') {
      this.applyTheme(true);
    } else {
      this.applyTheme(false);
    }
  }

  toggle(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  setTheme(mode: ThemeMode): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_KEY, mode);
    }
    this.applyTheme(mode === 'dark');
  }

  private applyTheme(dark: boolean): void {
    this.isDark.set(dark);
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.add('theme-switching');
      if (dark) {
        root.classList.add('dark');
        document.body?.classList.add('dark');
      } else {
        root.classList.remove('dark');
        document.body?.classList.remove('dark');
      }
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#101114' : '#F8F6EE');
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    }
  }
}

