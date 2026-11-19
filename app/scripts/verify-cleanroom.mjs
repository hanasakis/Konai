// Konai cleanroom gate: hash blacklist + forbidden patterns + build-input whitelist.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
import crypto from 'node:crypto'
import { globSync } from 'node:fs'

const ROOT = path.resolve(__dirname, '..')
const SCAN_DIRS = ['src', 'out', 'build', 'dist']
const BLACKLIST = path.resolve(__dirname, '../../cleanroom', 'typora-file-hashes.txt')
const PATTERNS = path.resolve(__dirname, '../../cleanroom', 'FORBIDDEN_PATTERNS.txt')
const FORBIDDEN_DIRS = ['_work/typora_inst']

function sha256(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') }

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

// Electron/Chromium shared runtime files are not Typora-owned resources;
// a blacklist match on one of them is informational, not a cleanroom failure.
const electronRuntimeHashes = new Set()
const electronDist = path.join(ROOT, 'node_modules', 'electron', 'dist')
for (const f of walk(electronDist)) { try { electronRuntimeHashes.add(sha256(f)) } catch { /* ignore */ } }

const blacklist = new Set()
if (fs.existsSync(BLACKLIST)) {
  for (const line of fs.readFileSync(BLACKLIST, 'utf8').split('\n')) {
    const m = /^([0-9a-f]{64})\s+/.exec(line.trim())
    if (m) blacklist.add(m[1])
  }
}

const patterns = fs.existsSync(PATTERNS)
  ? fs.readFileSync(PATTERNS, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'))
  : []

let failures = 0
const hits = { hash: [], pattern: [], forbiddenPath: [], electron: [] }
for (const dir of SCAN_DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    const rel = path.relative(ROOT, file)
    if (FORBIDDEN_DIRS.some((d) => rel.split(path.sep).join('/').includes(d))) hits.forbiddenPath.push(rel)
    let h = ''
    try { h = sha256(file) } catch { continue }
    if (blacklist.has(h)) { if (electronRuntimeHashes.has(h)) hits.electron.push(rel); else hits.hash.push(rel) }
    let content = ''
    try { content = fs.readFileSync(file, 'utf8') } catch { continue }
    for (const pat of patterns) {
      if (content.toLowerCase().includes(pat.toLowerCase())) hits.pattern.push(rel + ' :: ' + pat)
    }
  }
}

console.log('Konai cleanroom gate')
console.log('  blacklist hashes:', blacklist.size)
console.log('  forbidden patterns:', patterns.length)
console.log('  hash hits:', hits.hash.length)
  console.log('  electron-runtime hash matches (allowed):', hits.electron.length)
  for (const h of hits.electron.slice(0, 10)) console.log('   ELECTRON', h)
console.log('  pattern hits:', hits.pattern.length)
console.log('  forbidden path hits:', hits.forbiddenPath.length)
for (const h of hits.hash.slice(0, 20)) console.log('   HASH', h)
for (const h of hits.pattern.slice(0, 40)) console.log('   PATTERN', h)
for (const h of hits.forbiddenPath.slice(0, 20)) console.log('   PATH', h)
if (hits.hash.length || hits.pattern.length || hits.forbiddenPath.length) { failures = 1 } else { console.log('  RESULT: PASS') }
process.exit(failures)