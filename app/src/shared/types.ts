
export interface FileEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  mtime: number
  birthtime?: number
}

export interface DocSnapshot {
  path: string
  name: string
  text: string
  mtime: number
  encoding: string
  lineEnding: 'LF' | 'CRLF'
}

export interface QuickOpenItem { path: string; name: string; dir: string; score: number }

export interface SearchResult { path: string; name: string; line: number; column: number; text: string; preview: string }

export interface ExportHtmlOptions {
  path: string
  text: string
  title: string
  theme: string
  dark: boolean
  styled: boolean
  mathMode: 'svg' | 'latex'
  includeStyles: boolean
}

export interface ExportPdfOptions {
  path: string
  text: string
  title: string
  theme: string
  dark: boolean
  pageSize: string
  margin: { top: number; bottom: number; left: number; right: number }
  header: string
  footer: string
  pageBreak: boolean
  printBackground: boolean
  bookmarks: boolean
}

export interface ExportDocxOptions { path: string; text: string; title: string }

export interface ExportImageOptions { path: string; dataUrl: string; width: number; height: number }

export interface Config {
  theme: string
  darkTheme: string
  useSeparateDarkTheme: boolean
  followSystemTheme: boolean
  fontSize: number
  contentWidth: number
  lineHeight: number
  fontFamily: string
  monospaceFont: string
  autoSaveTimer: number
  autoHideMenuBar: boolean
  showStatusBar: boolean
  showHiddenFiles: boolean
  showAllFiles: boolean
  fileFilter: string
  sortBy: 'name' | 'modified' | 'created'
  sortAsc: boolean
  groupByFolder: boolean
  sidebarWidth: number
  sidebarVisible: boolean
  sidebarTab: 'file' | 'outline'
  highlight: boolean
  superscript: boolean
  subscript: boolean
  emoji: boolean
  smartPunctuation: boolean
  autoPair: boolean
  autoPairMarkdown: boolean
  latexDelimiters: boolean
  autoNumberMath: 'none' | 'ams' | 'all'
  codeLineNumbers: boolean
  readonlyMode: boolean
  focusMode: boolean
  typewriterMode: boolean
  typewriterSpeed: number
  spellCheck: boolean
  windowStyle: 'classic' | 'seamless' | 'unibody'
  zoomFactor: number
  keyBinding: Record<string, string>
  recentFiles: Array<{ n: string; p: string }>
  recentFolders: Array<{ n: string; p: string; pinned?: boolean }>
  lastFolder: string
  outlineCollapsible: boolean
  outlineHighlight: boolean
  [key: string]: unknown
}

export const DEFAULT_CONFIG: Config = {
  theme: 'github',
  darkTheme: 'night',
  useSeparateDarkTheme: false,
  followSystemTheme: true,
  fontSize: 16,
  contentWidth: 860,
  lineHeight: 1.6,
  fontFamily: 'system',
  monospaceFont: 'Consolas',
  autoSaveTimer: 5,
  autoHideMenuBar: false,
  showStatusBar: true,
  showHiddenFiles: false,
  showAllFiles: false,
  fileFilter: '',
  sortBy: 'name',
  sortAsc: true,
  groupByFolder: true,
  sidebarWidth: 260,
  sidebarVisible: true,
  sidebarTab: 'file',
  highlight: false,
  superscript: false,
  subscript: false,
  emoji: true,
  smartPunctuation: false,
  autoPair: true,
  autoPairMarkdown: true,
  latexDelimiters: true,
  autoNumberMath: 'none',
  codeLineNumbers: false,
  readonlyMode: false,
  focusMode: false,
  typewriterMode: false,
  typewriterSpeed: 240,
  spellCheck: false,
  windowStyle: 'classic',
  zoomFactor: 1,
  keyBinding: {},
  recentFiles: [],
  recentFolders: [],
  lastFolder: '',
  outlineCollapsible: true,
  outlineHighlight: true,
}
