
import { app, BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_CONFIG, Config } from '@shared/types'

function deepMerge(base: any, patch: any): any {
  if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) return patch
  const out: any = { ...base }
  for (const k of Object.keys(patch)) {
    const bv = (base as any)[k]
    const pv = patch[k]
    if (pv && typeof pv === 'object' && !Array.isArray(pv) && bv && typeof bv === 'object' && !Array.isArray(bv)) {
      out[k] = deepMerge(bv, pv)
    } else {
      out[k] = pv
    }
  }
  return out
}

let config: Config = { ...DEFAULT_CONFIG }
const listeners = new Set<(c: Config) => void>()

export function confDir(): string { return join(app.getPath('userData'), 'conf') }
export function userConfPath(): string { return join(confDir(), 'conf.user.json') }
export function defaultConfPath(): string { return join(confDir(), 'conf.default.json') }

export function loadConfig(): Config {
  const dir = confDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  let user: any = {}
  if (existsSync(userConfPath())) {
    try { user = JSON.parse(readFileSync(userConfPath(), 'utf8')) } catch { user = {} }
  }
  config = deepMerge({ ...DEFAULT_CONFIG }, user) as Config
  if (!existsSync(defaultConfPath())) {
    try { writeFileSync(defaultConfPath(), JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8') } catch { /* ignore */ }
  }
  return config
}

export function getConfig(): Config { return config }

export function saveConfig(patch: Partial<Config>): { ok: boolean; errors?: string[] } {
  try {
    const next = deepMerge(config, patch) as Config
    const dir = confDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const tmp = userConfPath() + '.tmp'
    writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8')
    renameSync(tmp, userConfPath())
    config = next
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('konai:config', config)
    for (const fn of listeners) fn(config)
    return { ok: true }
  } catch (e) {
    return { ok: false, errors: [String(e)] }
  }
}

export function onConfig(fn: (c: Config) => void): void { listeners.add(fn) }
export function offConfig(fn: (c: Config) => void): void { listeners.delete(fn) }

export function addRecentFile(path: string, name: string): void {
  const list = (config.recentFiles || []).filter((f) => f.p !== path)
  list.unshift({ n: name, p: path })
  if (list.length > 50) list.length = 50
  saveConfig({ recentFiles: list })
}

export function addRecentFolder(path: string, name: string): void {
  const list = (config.recentFolders || []).filter((f) => f.p !== path)
  list.unshift({ n: name, p: path, pinned: list.find((f) => f.p === path)?.pinned })
  if (list.length > 30) list.length = 30
  saveConfig({ recentFolders: list })
}
