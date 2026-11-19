
import base from './base.css?raw'
import github from './themes/github.css?raw'
import newsprint from './themes/newsprint.css?raw'
import night from './themes/night.css?raw'
import pixyll from './themes/pixyll.css?raw'
import whitey from './themes/whitey.css?raw'

export interface ThemeDef { id: string; name: string; mode: 'light' | 'dark'; css: string }

export const THEMES: ThemeDef[] = [
  { id: 'github', name: 'GitHub', mode: 'light', css: github },
  { id: 'newsprint', name: 'Newsprint', mode: 'light', css: newsprint },
  { id: 'night', name: 'Night', mode: 'dark', css: night },
  { id: 'pixyll', name: 'Pixyll', mode: 'light', css: pixyll },
  { id: 'whitey', name: 'Whitey', mode: 'light', css: whitey },
]

export const DEFAULT_CSS = base

export function themeById(id: string): ThemeDef {
  return THEMES.find((t) => t.id === id) || THEMES[0]
}

export function themeCss(id: string): string {
  return base + '\n' + themeById(id).css
}

export function isDarkTheme(id: string): boolean {
  return themeById(id).mode === 'dark'
}

let styleEl: HTMLStyleElement | null = null

export function applyTheme(id: string, dark: boolean): void {
  document.documentElement.dataset.konaiTheme = id
  document.documentElement.dataset.konaiMode = dark ? 'dark' : 'light'
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'konai-theme'
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = themeCss(id)
}
