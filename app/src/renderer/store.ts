
import { create } from 'zustand'
import { Config, DEFAULT_CONFIG, FileEntry, DocSnapshot } from '@shared/types'

export interface DocState {
  path: string
  name: string
  text: string
  savedText: string
  mtime: number
  dirty: boolean
  encoding: string
  lineEnding: 'LF' | 'CRLF'
}

export function docFromSnapshot(s: DocSnapshot): DocState {
  return { path: s.path, name: s.name, text: s.text, savedText: s.text, mtime: s.mtime, dirty: false, encoding: s.encoding, lineEnding: s.lineEnding }
}

export function untitledDoc(): DocState {
  return { path: '', name: '未命名.md', text: '', savedText: '', mtime: 0, dirty: true, encoding: 'utf-8', lineEnding: 'LF' }
}

interface AppState {
  config: Config
  setConfigLocal: (patch: Partial<Config>) => void
  saveConfig: (patch: Partial<Config>) => void

  folder: string | null
  setFolder: (f: string | null) => void
  files: FileEntry[]
  setFiles: (f: FileEntry[]) => void

  tabs: DocState[]
  activeTab: number
  setTabs: (t: DocState[]) => void
  setActiveTab: (i: number) => void
  updateTab: (i: number, patch: Partial<DocState>) => void
  closeTab: (i: number) => void

  mode: 'wysiwyg' | 'source'
  setMode: (m: 'wysiwyg' | 'source') => void
  dialog: string | null
  setDialog: (d: string | null) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  outline: Array<{ level: number; text: string; line: number; from: number; id: string }>
  setOutline: (o: any[]) => void
  readonly: boolean
  setReadonly: (v: boolean) => void
  focusMode: boolean
  setFocusMode: (v: boolean) => void
  typewriterMode: boolean
  setTypewriterMode: (v: boolean) => void
  status: string
  setStatus: (s: string) => void
}

export const useStore = create<AppState>((set, get) => ({
  config: { ...DEFAULT_CONFIG },
  setConfigLocal: (patch) => set({ config: { ...get().config, ...patch } }),
  saveConfig: (patch) => {
    set({ config: { ...get().config, ...patch } })
    window.konai?.config.save(patch).catch(() => { /* ignore */ })
  },

  folder: null,
  setFolder: (folder) => set({ folder }),
  files: [],
  setFiles: (files) => set({ files }),

  tabs: [],
  activeTab: -1,
  setTabs: (tabs) => set({ tabs, activeTab: tabs.length ? Math.min(get().activeTab < 0 ? 0 : get().activeTab, tabs.length - 1) : -1 }),
  setActiveTab: (activeTab) => set({ activeTab }),
  updateTab: (i, patch) => set({ tabs: get().tabs.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) }),
  closeTab: (i) => {
    const tabs = get().tabs.filter((_, idx) => idx !== i)
    let activeTab = get().activeTab
    if (tabs.length === 0) activeTab = -1
    else if (activeTab >= tabs.length) activeTab = tabs.length - 1
    else if (i < activeTab) activeTab = activeTab - 1
    set({ tabs, activeTab })
  },

  mode: 'wysiwyg',
  setMode: (mode) => set({ mode }),
  dialog: null,
  setDialog: (dialog) => set({ dialog }),
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  outline: [],
  setOutline: (outline) => set({ outline }),
  readonly: false,
  setReadonly: (readonly) => set({ readonly }),
  focusMode: false,
  setFocusMode: (focusMode) => set({ focusMode }),
  typewriterMode: false,
  setTypewriterMode: (typewriterMode) => set({ typewriterMode }),
  status: '',
  setStatus: (status) => set({ status }),
}))
