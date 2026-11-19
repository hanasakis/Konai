
import { app, shell } from 'electron'
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, statSync,
  unlinkSync, rmSync, copyFileSync, readdirSync
} from 'node:fs'
import { join, basename, dirname, extname, resolve, sep } from 'node:path'
import chokidar from 'chokidar'
import { Config, DocSnapshot, FileEntry } from '@shared/types'

export function isTextFile(name: string): boolean {
  return /\.(md|markdown|mmd|mkd|mdwn|mdown|mdx|mdtxt|mdtext|apib|rmarkdown|rmd|qmd|txt|text|json|ya?ml|toml|ini|log|csv)$/i.test(name)
}

export function listDir(path: string, cfg: Config): FileEntry[] {
  let raw: string[] = []
  try { raw = readdirSync(path) } catch { return [] }
  const entries: FileEntry[] = []
  for (const name of raw) {
    if (name === '.' || name === '..') continue
    if (!cfg.showHiddenFiles && name.startsWith('.')) continue
    const full = join(path, name)
    let st: any
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) {
      entries.push({ name, path: full, isDir: true, size: 0, mtime: st.mtimeMs, birthtime: st.birthtimeMs })
    } else {
      if (!cfg.showAllFiles && !isTextFile(name)) continue
      if (cfg.fileFilter) {
        const pats = cfg.fileFilter.split(',').map((s) => s.trim()).filter(Boolean)
        const included = pats.some((p) => !p.startsWith('!') && globMatch(p, name))
        const excluded = pats.some((p) => p.startsWith('!') && globMatch(p.slice(1), name))
        if (excluded || (pats.some((p) => !p.startsWith('!')) && !included)) continue
      }
      entries.push({ name, path: full, isDir: false, size: st.size, mtime: st.mtimeMs, birthtime: st.birthtimeMs })
    }
  }
  const dirFirst = cfg.groupByFolder !== false
  const key = cfg.sortBy === 'modified' ? 'mtime' : cfg.sortBy === 'created' ? 'birthtime' : 'name'
  entries.sort((a, b) => {
    if (dirFirst && a.isDir !== b.isDir) return a.isDir ? -1 : 1
    let r = 0
    if (key === 'name') r = naturalCompare(a.name, b.name)
    else r = ((a as any)[key] ?? 0) - ((b as any)[key] ?? 0)
    return cfg.sortAsc ? r : -r
  })
  return entries
}

export function naturalCompare(a: string, b: string): number {
  const na = a.replace(/\d+/g, (m) => m.padStart(12, '0')).toLowerCase()
  const nb = b.replace(/\d+/g, (m) => m.padStart(12, '0')).toLowerCase()
  return na < nb ? -1 : na > nb ? 1 : 0
}

export function globMatch(pattern: string, name: string): boolean {
  const re = new RegExp('^' + pattern.replace(/[.+{}^$*?()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i')
  return re.test(name)
}

export function readFileSnapshot(path: string): DocSnapshot {
  const buf = readFileSync(path)
  const text = buf.toString('utf8')
  const st = statSync(path)
  const crlf = (text.match(/\r\n/g) || []).length > 0 && (text.match(/\r\n/g) || []).length >= (text.match(/\n/g) || []).length * 0.5
  return { path, name: basename(path), text, mtime: st.mtimeMs, encoding: 'utf-8', lineEnding: crlf ? 'CRLF' : 'LF' }
}

export function writeFileAtomic(path: string, text: string): number {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = path + '.konai-tmp-' + process.pid + '-' + Date.now()
  writeFileSync(tmp, text, 'utf8')
  renameSync(tmp, path)
  return statSync(path).mtimeMs
}

export function newFile(dir: string, name: string): FileEntry {
  const p = resolvePath(dir, name)
  if (!p) throw new Error('illegal path')
  mkdirSync(dirname(p), { recursive: true })
  if (!existsSync(p)) writeFileSync(p, '', 'utf8')
  const st = statSync(p)
  return { name: basename(p), path: p, isDir: false, size: st.size, mtime: st.mtimeMs }
}

export function newFolder(dir: string, name: string): FileEntry {
  const p = resolvePath(dir, name)
  if (!p) throw new Error('illegal path')
  mkdirSync(p, { recursive: true })
  const st = statSync(p)
  return { name: basename(p), path: p, isDir: true, size: 0, mtime: st.mtimeMs }
}

export function resolvePath(base: string, name: string): string | null {
  if (!base || !name) return null
  const clean = name.replace(/^\\+/, '')
  const p = resolve(base, clean)
  if (p !== base && !p.startsWith(base + sep)) return null
  return p
}

export function renamePath(oldPath: string, newPath: string): void {
  mkdirSync(dirname(newPath), { recursive: true })
  renameSync(oldPath, newPath)
}

export function movePaths(paths: string[], targetDir: string): void {
  mkdirSync(targetDir, { recursive: true })
  for (const p of paths) {
    const dest = join(targetDir, basename(p))
    if (resolve(dest) === resolve(p)) continue
    movePath(p, dest)
  }
}

interface TrashRecord { original: string; backup: string; time: number; isDir: boolean }
const trashLog: TrashRecord[] = []

export async function trashPaths(paths: string[]): Promise<{ ok: boolean; undoId: string }> {
  const backupRoot = join(app.getPath('userData'), 'trash-backup')
  mkdirSync(backupRoot, { recursive: true })
  const id = 'trash-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
  const backupDir = join(backupRoot, id)
  mkdirSync(backupDir, { recursive: true })
  const rec: TrashRecord = { original: paths[0], backup: backupDir, time: Date.now(), isDir: false }
  for (const p of paths) {
    try {
      copyRecursive(p, join(backupDir, basename(p)))
      await shell.trashItem(p)
    } catch {
      try { rmSync(p, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }
  trashLog.push(rec)
  return { ok: true, undoId: id }
}

function copyRecursive(src: string, dest: string): void {
  const st = statSync(src)
  if (st.isDirectory()) {
    mkdirSync(dest, { recursive: true })
    for (const n of readdirSync(src)) copyRecursive(join(src, n), join(dest, n))
  } else {
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(src, dest)
  }
}

export function undoTrash(undoId: string): { ok: boolean } {
  const rec = trashLog.find((r) => r.backup.endsWith(undoId))
  if (!rec) return { ok: false }
  try {
    const names = readdirSync(rec.backup)
    for (const n of names) {
      const src = join(rec.backup, n)
      const dest = join(dirname(rec.original), n)
      if (!existsSync(dest)) movePath(src, dest)
    }
    rmSync(rec.backup, { recursive: true, force: true })
    return { ok: true }
  } catch { return { ok: false } }
}

export function emptyTrashBackup(): void {
  try { rmSync(join(app.getPath('userData'), 'trash-backup'), { recursive: true, force: true }) } catch { /* ignore */ }
}

export function draftsDir(): string { return join(app.getPath('userData'), 'drafts') }

export function saveDraft(path: string, text: string): void {
  const dir = draftsDir()
  mkdirSync(dir, { recursive: true })
  const id = hash(path)
  writeFileSync(join(dir, id + '.md'), text, 'utf8')
  writeFileSync(join(dir, id + '.json'), JSON.stringify({ path, time: Date.now(), size: text.length }), 'utf8')
}

export function listDrafts(): Array<{ path: string; time: number; size: number }> {
  const dir = draftsDir()
  if (!existsSync(dir)) return []
  const out: Array<{ path: string; time: number; size: number }> = []
  for (const n of readdirSync(dir)) {
    if (!n.endsWith('.json')) continue
    try {
      const meta = JSON.parse(readFileSync(join(dir, n), 'utf8'))
      out.push({ path: meta.path, time: meta.time, size: meta.size })
    } catch { /* ignore */ }
  }
  return out.sort((a, b) => b.time - a.time)
}

export function readDraft(path: string): string | null {
  const f = join(draftsDir(), hash(path) + '.md')
  if (!existsSync(f)) return null
  try { return readFileSync(f, 'utf8') } catch { return null }
}

export function clearDraft(path: string): void {
  const id = hash(path)
  try { unlinkSync(join(draftsDir(), id + '.md')) } catch { /* ignore */ }
  try { unlinkSync(join(draftsDir(), id + '.json')) } catch { /* ignore */ }
}

function hash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0 }
  return (h >>> 0).toString(36)
}

let watcher: any = null

export function watchWorkspace(root: string, onEvent: (ev: any) => void): void {
  unwatchWorkspace()
  if (!root || !existsSync(root)) return
  try {
    watcher = chokidar.watch(root, {
      ignored: [/(^|[\\/])\./, /node_modules/, /[\\/]\.git[\\/]/, '**/*.konai-tmp-*'],
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 60 },
    })
    watcher.on('all', (ev: string, p: string) => onEvent({ type: ev, path: p }))
    watcher.on('error', () => { /* ignore */ })
  } catch { watcher = null }
}

export function unwatchWorkspace(): void {
  if (watcher) { try { watcher.close() } catch { /* ignore */ } watcher = null }
}

export function movePath(src: string, dest: string): void {
  try { renameSync(src, dest); return } catch { /* cross-device */ }
  copyRecursive(src, dest)
  try { rmSync(src, { recursive: true, force: true }) } catch { /* ignore */ }
}

export function normalizePath(p: string): string { return resolve(p) }
export function extOf(p: string): string { return extname(p).replace(/^\\./, '').toLowerCase() }