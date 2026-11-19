
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { QuickOpenItem, SearchResult } from '@shared/types'

const SKIP = new Set(['node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', 'target', '.konai'])
const TEXT_EXT = /\.(md|markdown|mmd|mkd|mdwn|mdown|mdx|mdtxt|mdtext|txt|text|json|ya?ml|toml|ini|log|csv|html?|css|js|ts|tsx|jsx|py|rs|go|java|c|h|cpp|hpp|cs|php|rb|sh|bat|ps1)$/i

export function walkFiles(root: string, opts: { includeHidden?: boolean; max?: number; glob?: string } = {}): string[] {
  const out: string[] = []
  const max = opts.max ?? 20000
  const stack: string[] = [root]
  let iterations = 0
  while (stack.length && out.length < max && iterations < 20000) {
    iterations++
    const dir = stack.pop() as string
    let names: string[] = []
    try { names = readdirSync(dir) } catch { continue }
    for (const name of names) {
      if (out.length >= max) break
      if (!opts.includeHidden && name.startsWith('.')) continue
      if (SKIP.has(name)) continue
      const full = join(dir, name)
      let st: any
      try { st = statSync(full) } catch { continue }
      if (st.isDirectory()) stack.push(full)
      else if (TEXT_EXT.test(name)) {
        if (opts.glob && !globMatch(opts.glob, name)) continue
        out.push(full)
      }
    }
  }
  return out
}

export function globMatch(pattern: string, name: string): boolean {
  const re = new RegExp('^' + pattern.replace(/[.+{}^$*?()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i')
  return re.test(name)
}

export function fuzzyScore(query: string, target: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let score = 0
  let ti = 0
  let consecutive = 0
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]
    let found = -1
    for (let j = ti; j < t.length; j++) { if (t[j] === ch) { found = j; break } }
    if (found < 0) return 0
    consecutive = found === ti ? consecutive + 1 : 0
    score += 1 + consecutive * 2
    if (found === 0) score += 3
    ti = found + 1
  }
  const name = basename(target).toLowerCase()
  if (name.startsWith(q)) score += 10
  if (name === q) score += 20
  return score
}

export function quickOpen(query: string, root: string): QuickOpenItem[] {
  const files = walkFiles(root, { max: 20000 })
  const items: QuickOpenItem[] = []
  for (const path of files) {
    const name = basename(path)
    const s = Math.max(fuzzyScore(query, name), fuzzyScore(query, path))
    if (s > 0) items.push({ path, name, dir: path.slice(0, path.length - name.length - 1), score: s })
  }
  items.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  return items.slice(0, 100)
}

export function globalSearch(query: string, root: string, opts: { regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean; fileNameFilter?: string; max?: number } = {}): SearchResult[] {
  const files = walkFiles(root, { max: 4000 })
  let re: RegExp
  try {
    const body = opts.regex ? query : escapeRegExp(query)
    re = new RegExp(body, opts.caseSensitive ? 'g' : 'gi')
  } catch { return [] }
  const out: SearchResult[] = []
  const max = opts.max ?? 500
  for (const path of files) {
    if (out.length >= max) break
    const name = basename(path)
    if (opts.fileNameFilter && !globMatch(opts.fileNameFilter, name)) continue
    let text: string
    try {
      const st = statSync(path)
      if (st.size > 2 * 1024 * 1024) continue
      text = readFileSync(path, 'utf8')
    } catch { continue }
    const lines = text.split(/\r\n|\r|\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      re.lastIndex = 0
      let m: RegExpExecArray | null
      let count = 0
      while ((m = re.exec(line)) && count < 5) {
        out.push({ path, name, line: i + 1, column: m.index + 1, text: line.trim().slice(0, 200), preview: line.trim().slice(0, 200) })
        if (out.length >= max) break
        count++
        if (m[0].length === 0) re.lastIndex++
      }
    }
  }
  return out
}

function escapeRegExp(s: string): string { return s.replace(/[.+{}^$*?()|[\]\\]/g, '\\$&') }
