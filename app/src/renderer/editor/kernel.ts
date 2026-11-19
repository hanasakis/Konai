
// Konai editor kernel: Markdown block + inline parsing (clean-room, original implementation).
// Source text is the single source of truth; this module only derives structure.

export type BlockType =
  | 'frontmatter' | 'heading' | 'paragraph' | 'hr' | 'fence' | 'math'
  | 'table' | 'blockquote' | 'list' | 'html' | 'toc' | 'alert' | 'media' | 'footnote'

export interface Block {
  type: BlockType
  fromLine: number
  toLine: number
  from: number
  to: number
  raw: string
  lang?: string
  level?: number
  text?: string
  ordered?: boolean
  alert?: string
  header?: string[]
  align?: Array<'left' | 'center' | 'right' | null>
  rows?: string[][]
  code?: string
  math?: string
  diagram?: string
  url?: string
}

export interface InlineToken {
  type: string
  from: number
  to: number
  innerFrom?: number
  innerTo?: number
  hide?: Array<[number, number]>
  url?: string
  title?: string
  alt?: string
  text?: string
  lang?: string
  raw?: string
  tag?: string
  attrs?: string
  emoji?: string
  id?: string
  ref?: string
}

export interface InlineOptions {
  highlight?: boolean
  superscript?: boolean
  subscript?: boolean
  emoji?: boolean
  latexDelimiters?: boolean
  autolink?: boolean
  html?: boolean
  footnoteDefs?: Map<string, string>
}

export interface OutlineItem { level: number; text: string; line: number; from: number; id: string }

const BT = '\x60'

const BLOCK_TAGS = [
  'address','article','aside','base','basefont','blockquote','body','caption','center','col','colgroup',
  'dd','details','dialog','dir','div','dl','dt','fieldset','figcaption','figure','footer','form','frame',
  'frameset','h1','h2','h3','h4','h5','h6','head','header','hr','html','iframe','legend','li','link',
  'main','menu','menuitem','nav','noframes','ol','optgroup','option','p','param','section','source',
  'summary','table','tbody','td','tfoot','th','thead','title','tr','track','ul','video','audio','pre','script','style'
]

function isBlank(line: string): boolean { return /^\s*$/.test(line) }

export function lineStarts(text: string): number[] {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1)
  return starts
}

export function getLines(text: string): { lines: string[]; starts: number[] } {
  const starts = lineStarts(text)
  const lines: string[] = []
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i]
    const e = i + 1 < starts.length ? starts[i + 1] - 1 : text.length
    let line = text.slice(s, e)
    if (line.endsWith('\r')) line = line.slice(0, -1)
    lines.push(line)
  }
  return { lines, starts }
}

export function offsetAt(starts: number[], line: number, column = 0): number {
  return (starts[line] ?? 0) + column
}

function splitTableRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue }
    if (c === '|') { cells.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  cells.push(cur.trim())
  return cells
}

function isTableDelimiter(line: string): boolean {
  const t = line.trim()
  if (!t.includes('-')) return false
  const cells = splitTableRow(t)
  if (cells.length === 0) return false
  return cells.every(c => /^:?-+:?$/.test(c))
}

export function parseBlocks(text: string): Block[] {
  const { lines, starts } = getLines(text)
  const blocks: Block[] = []
  const n = lines.length
  let i = 0
  const endOffset = (idx: number) => (idx < n ? starts[idx] + lines[idx].length : text.length)

  while (i < n) {
    const line = lines[i]
    if (isBlank(line)) { i++; continue }

    if (i === 0 && (/^---\s*$/.test(line) || /^\+\+\+\s*$/.test(line))) {
      const fence = line.trim()
      let j = i + 1
      while (j < n && lines[j].trim() !== fence) j++
      const end = Math.min(j, n - 1)
      const to = endOffset(end)
      blocks.push({ type: 'frontmatter', fromLine: i, toLine: end, from: starts[i], to, raw: text.slice(starts[i], to) })
      i = end + 1
      continue
    }

    const fenceM = line.match(/^ {0,3}(\x60{3,}|~{3,})(.*)$/)
    if (fenceM) {
      const marker = fenceM[1][0]
      const len = fenceM[1].length
      const info = fenceM[2].trim()
      let j = i + 1
      const closeRe = new RegExp('^ {0,3}' + (marker === BT ? BT : '~') + '{' + len + ',}\\s*$')
      while (j < n && !closeRe.test(lines[j])) j++
      const end = Math.min(j, n - 1)
      const to = endOffset(end)
      const lang = info.split(/\s+/)[0] || ''
      const body = lines.slice(i + 1, j).join('\n')
      const isDiagram = ['mermaid', 'flow', 'sequence', 'zenuml', 'gantt', 'graph', 'diagrams', 'plantuml'].includes(lang.toLowerCase())
      blocks.push({
        type: isDiagram ? 'media' : 'fence', fromLine: i, toLine: end,
        from: starts[i], to, raw: text.slice(starts[i], to), lang, code: body,
        diagram: isDiagram ? body : undefined,
        url: isDiagram ? lang.toLowerCase() : undefined,
      })
      i = end + 1
      continue
    }

    if (/^ {0,3}\$\$\s*$/.test(line)) {
      let j = i + 1
      while (j < n && !/^ {0,3}\$\$\s*$/.test(lines[j])) j++
      const end = Math.min(j, n - 1)
      const to = endOffset(end)
      blocks.push({ type: 'math', fromLine: i, toLine: end, from: starts[i], to, raw: text.slice(starts[i], to), math: lines.slice(i + 1, j).join('\n') })
      i = end + 1
      continue
    }
    const oneLineMath = line.match(/^ {0,3}\$\$([\s\S]*?)\$\$\s*$/)
    if (oneLineMath) {
      blocks.push({ type: 'math', fromLine: i, toLine: i, from: starts[i], to: starts[i] + line.length, raw: line, math: oneLineMath[1] })
      i++; continue
    }

    const h = line.match(/^(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/)
    if (h) {
      const level = h[1].length
      const t = (h[2] ?? '').replace(/[ \t]+#+[ \t]*$/, '')
      blocks.push({ type: 'heading', fromLine: i, toLine: i, from: starts[i], to: starts[i] + line.length, raw: line, level, text: t })
      i++; continue
    }

    if (/^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/.test(line)) {
      blocks.push({ type: 'hr', fromLine: i, toLine: i, from: starts[i], to: starts[i] + line.length, raw: line })
      i++; continue
    }

    if (/^ {0,3}>/.test(line)) {
      let j = i
      while (j < n) {
        if (/^ {0,3}>/.test(lines[j])) { j++; continue }
        if (j > i && !isBlank(lines[j]) && /^ {0,3}>/.test(lines[j - 1])) { j++; continue }
        break
      }
      const end = j - 1
      const inner = lines[i].replace(/^ {0,3}>\s?/, '')
      const alertM = inner.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i)
      const to = endOffset(end)
      blocks.push({
        type: alertM ? 'alert' : 'blockquote', fromLine: i, toLine: end, from: starts[i], to,
        raw: text.slice(starts[i], to),
        alert: alertM ? alertM[1].toUpperCase() : undefined, text: alertM ? alertM[2] : undefined,
      })
      i = end + 1
      continue
    }

    if (line.includes('|') && i + 1 < n && isTableDelimiter(lines[i + 1])) {
      const header = splitTableRow(line)
      const align = splitTableRow(lines[i + 1]).map(c => {
        const l = c.startsWith(':'), r = c.endsWith(':')
        return l && r ? 'center' : r ? 'right' : l ? 'left' : null
      })
      let j = i + 2
      const rows: string[][] = []
      while (j < n && !isBlank(lines[j]) && lines[j].includes('|')) { rows.push(splitTableRow(lines[j])); j++ }
      const end = j - 1
      const to = endOffset(end)
      blocks.push({ type: 'table', fromLine: i, toLine: end, from: starts[i], to, raw: text.slice(starts[i], to), header, align, rows })
      i = end + 1
      continue
    }

    const lm = line.match(/^(\s*)([-*+]|\d{1,9}[.)])([ \t]+)(.*)$/)
    if (lm) {
      let j = i
      while (j < n) {
        const l = lines[j]
        if (isBlank(l)) {
          if (j + 1 < n && (/^\s*([-*+]|\d{1,9}[.)])\s+/.test(lines[j + 1]) || /^\s+\S/.test(lines[j + 1]))) { j++; continue }
          break
        }
        if (/^\s*([-*+]|\d{1,9}[.)])\s+/.test(l) || /^\s+\S/.test(l)) { j++; continue }
        break
      }
      const end = j - 1
      const to = endOffset(end)
      blocks.push({ type: 'list', fromLine: i, toLine: end, from: starts[i], to, raw: text.slice(starts[i], to), ordered: /^\s*\d/.test(line) })
      i = end + 1
      continue
    }

    if (/^\s*\[toc\]\s*$/i.test(line)) {
      blocks.push({ type: 'toc', fromLine: i, toLine: i, from: starts[i], to: starts[i] + line.length, raw: line })
      i++; continue
    }

    if (/^ {0,3}<(\/?[a-zA-Z][a-zA-Z0-9]*|!|\?)/.test(line)) {
      const tagM = line.match(/^ {0,3}<([a-zA-Z][a-zA-Z0-9]*)/)
      const tag = tagM ? tagM[1].toLowerCase() : ''
      let j = i
      const closing = '</' + tag + '>'
      if (BLOCK_TAGS.includes(tag) && !line.includes(closing)) {
        j = i + 1
        while (j < n && !lines[j].includes(closing)) j++
      } else {
        j = i
        while (j < n && !isBlank(lines[j])) j++
      }
      const end = Math.min(j, n - 1)
      const to = endOffset(end)
      blocks.push({ type: 'html', fromLine: i, toLine: end, from: starts[i], to, raw: text.slice(starts[i], to), lang: tag })
      i = end + 1
      continue
    }

    let j = i
    while (j < n && !isBlank(lines[j])) {
      if (j > i && (/^ {0,3}(#{1,6})[ \t]+/.test(lines[j]) || /^ {0,3}(\x60{3,}|~{3,})/.test(lines[j]) || /^ {0,3}>/.test(lines[j]) || /^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,})$/.test(lines[j]) || /^\s*\[toc\]\s*$/i.test(lines[j]) || /^(\s*)([-*+]|\d{1,9}[.)])([ \t]+)/.test(lines[j]) || (lines[j].includes('|') && j + 1 < n && isTableDelimiter(lines[j + 1])))) break
      j++
    }
    const end = j - 1
    const first = lines[i]
    const second = i + 1 < n ? lines[i + 1] : ''
    if (/^ {0,3}=+\s*$/.test(second)) {
      blocks.push({ type: 'heading', fromLine: i, toLine: i + 1, from: starts[i], to: starts[i + 1] + lines[i + 1].length, raw: first + '\n' + second, level: 1, text: first.trim() })
      i = i + 2; continue
    }
    if (/^ {0,3}-+\s*$/.test(second) && !/^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,})$/.test(first)) {
      blocks.push({ type: 'heading', fromLine: i, toLine: i + 1, from: starts[i], to: starts[i + 1] + lines[i + 1].length, raw: first + '\n' + second, level: 2, text: first.trim() })
      i = i + 2; continue
    }
    const to = endOffset(end)
    blocks.push({ type: 'paragraph', fromLine: i, toLine: end, from: starts[i], to, raw: text.slice(starts[i], to) })
    i = end + 1
  }

  return blocks
}

const EMOJI: Record<string, string> = {
  smile: '\u{1F604}', smiley: '\u{1F603}', grinning: '\u{1F600}', grin: '\u{1F601}', laughing: '\u{1F606}', satisfied: '\u{1F606}',
  sweat_smile: '\u{1F605}', joy: '\u{1F602}', rofl: '\u{1F923}', relaxed: '\u263A\uFE0F', blush: '\u{1F60A}', innocent: '\u{1F607}',
  slightly_smiling_face: '\u{1F642}', upside_down_face: '\u{1F643}', wink: '\u{1F609}', heart_eyes: '\u{1F60D}', kissing_heart: '\u{1F618}',
  kissing: '\u{1F617}', kissing_smiling_eyes: '\u{1F619}', kissing_closed_eyes: '\u{1F61A}', yum: '\u{1F60B}', stuck_out_tongue: '\u{1F61B}',
  stuck_out_tongue_winking_eye: '\u{1F61C}', stuck_out_tongue_closed_eyes: '\u{1F61D}', neutral_face: '\u{1F610}', expressionless: '\u{1F611}',
  no_mouth: '\u{1F636}', smirk: '\u{1F60F}', unamused: '\u{1F612}', sweat: '\u{1F613}', pensive: '\u{1F614}',
  confounded: '\u{1F616}', disappointed: '\u{1F61E}', worried: '\u{1F61F}', cry: '\u{1F622}', sob: '\u{1F62D}',
  angry: '\u{1F620}', rage: '\u{1F621}', triumph: '\u{1F624}', sleepy: '\u{1F62A}', tired_face: '\u{1F62B}',
  sleeping: '\u{1F634}', mask: '\u{1F637}', sunglasses: '\u{1F60E}', dizzy_face: '\u{1F635}', astonished: '\u{1F632}',
  scream: '\u{1F631}', fearful: '\u{1F628}', cold_sweat: '\u{1F630}', flushed: '\u{1F633}', scream_cat: '\u{1F640}',
  smiley_cat: '\u{1F63A}', smile_cat: '\u{1F638}', heart_eyes_cat: '\u{1F63B}', smirk_cat: '\u{1F63C}',
  thumbsup: '\u{1F44D}', '+1': '\u{1F44D}', thumbsdown: '\u{1F44E}', '-1': '\u{1F44E}', ok_hand: '\u{1F44C}',
  clap: '\u{1F44F}', pray: '\u{1F64F}', muscle: '\u{1F4AA}', point_up: '\u261D\uFE0F', point_down: '\u{1F447}',
  point_left: '\u{1F448}', point_right: '\u{1F449}', raised_hands: '\u{1F64C}', open_hands: '\u{1F450}',
  handshake: '\u{1F91D}', nail_care: '\u{1F485}', ear: '\u{1F442}', nose: '\u{1F443}', eyes: '\u{1F440}',
  brain: '\u{1F9E0}', bust_in_silhouette: '\u{1F464}', baby: '\u{1F476}', boy: '\u{1F466}', girl: '\u{1F467}',
  man: '\u{1F468}', woman: '\u{1F469}', older_man: '\u{1F474}', older_woman: '\u{1F475}', cop: '\u{1F46E}',
  construction_worker: '\u{1F477}', princess: '\u{1F478}', ghost: '\u{1F47B}', alien: '\u{1F47D}', robot: '\u{1F916}',
  skull: '\u{1F480}', heart: '\u2764\uFE0F', yellow_heart: '\u{1F49B}', green_heart: '\u{1F49A}', blue_heart: '\u{1F499}',
  purple_heart: '\u{1F49C}', broken_heart: '\u{1F494}', two_hearts: '\u{1F495}', sparkling_heart: '\u{1F496}',
  heartbeat: '\u{1F493}', star: '\u2B50', star2: '\u{1F31F}', sparkles: '\u2728', zap: '\u26A1', fire: '\u{1F525}',
  boom: '\u{1F4A5}', rainbow: '\u{1F308}', sunny: '\u2600\uFE0F', cloud: '\u2601\uFE0F', snowflake: '\u2744\uFE0F',
  umbrella: '\u2614', coffee: '\u2615', tea: '\u{1F375}', beer: '\u{1F37A}', wine_glass: '\u{1F377}',
  pizza: '\u{1F355}', burger: '\u{1F354}', fries: '\u{1F35F}', apple: '\u{1F34E}', banana: '\u{1F34C}',
  cherry: '\u{1F352}', strawberry: '\u{1F353}', watermelon: '\u{1F349}', peach: '\u{1F351}', cake: '\u{1F370}',
  birthday: '\u{1F382}', gift: '\u{1F381}', balloon: '\u{1F388}', tada: '\u{1F389}', confetti_ball: '\u{1F38A}',
  rocket: '\u{1F680}', airplane: '\u2708\uFE0F', car: '\u{1F697}', bus: '\u{1F68C}', train: '\u{1F686}',
  ship: '\u{1F6A2}', bike: '\u{1F6B2}', house: '\u{1F3E0}', office: '\u{1F3E2}', hospital: '\u{1F3E5}',
  school: '\u{1F3EB}', book: '\u{1F4D6}', books: '\u{1F4DA}', memo: '\u{1F4DD}', pencil: '\u{1F4DD}',
  pencil2: '\u270F\uFE0F', pen: '\u{1F58A}\uFE0F', paperclip: '\u{1F4CE}', scissors: '\u2702\uFE0F', lock: '\u{1F512}',
  key: '\u{1F511}', hammer: '\u{1F528}', gear: '\u2699\uFE0F', link: '\u{1F517}', mag: '\u{1F50D}',
  bulb: '\u{1F4A1}', checkered_flag: '\u{1F3C1}', warning: '\u26A0\uFE0F', white_check_mark: '\u2705', x: '\u274C',
  no_entry: '\u{1F6AB}', question: '\u2753', exclamation: '\u2757', '100': '\u{1F4AF}', heavy_check_mark: '\u2714\uFE0F',
  heavy_plus_sign: '\u2795', heavy_minus_sign: '\u2796', arrow_right: '\u{1F449}', arrow_left: '\u{1F448}',
  arrow_up: '\u{1F446}', arrow_down: '\u{1F447}', arrow_upper_right: '\u2197\uFE0F', arrow_lower_right: '\u2198\uFE0F',
  recycle: '\u{267B}\uFE0F', infinity: '\u267E\uFE0F', copyright: '\u00A9\uFE0F', registered: '\u00AE\uFE0F', tm: '\u2122\uFE0F',
}

export function emojiFor(name: string): string | undefined { return EMOJI[name.toLowerCase()] }

export function parseInline(src: string, base: number, opts: InlineOptions = {}): InlineToken[] {
  const tokens: InlineToken[] = []
  const n = src.length
  let i = 0
  const push = (t: InlineToken) => { if (t.to > t.from) tokens.push(t) }
  const hide = (from: number, to: number): Array<[number, number]> => (from < to ? [[base + from, base + to]] : [])

  while (i < n) {
    const rest = src.slice(i)
    const ch = src[i]

    if (ch === '\\' && i + 1 < n && src[i + 1] !== '(' && src[i + 1] !== '[') { i += 2; continue }

    if (ch === BT) {
      let ticks = 0
      while (src[i + ticks] === BT) ticks++
      const closeIdx = src.indexOf(BT.repeat(ticks), i + ticks)
      if (closeIdx >= 0) {
        const innerFrom = i + ticks, innerTo = closeIdx
        push({ type: 'code', from: base + i, to: base + closeIdx + ticks, innerFrom: base + innerFrom, innerTo: base + innerTo, hide: [...hide(i, innerFrom), ...hide(innerTo, closeIdx + ticks)], raw: src.slice(i, closeIdx + ticks) })
        i = closeIdx + ticks
        continue
      }
    }

    if (ch === '!' && src[i + 1] === '[') {
      const m = /^!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+["']([^"']*)["'])?\s*\)/.exec(rest)
      if (m) {
        const end = m[0].length
        push({ type: 'image', from: base + i, to: base + i + end, alt: m[1], url: m[2], title: m[3], raw: m[0], hide: [[base + i, base + i + end]] })
        i += end; continue
      }
    }

    if (ch === '[') {
      const fn = /^\[\^([^\]]+)\]/.exec(rest)
      if (fn) {
        push({ type: 'footnote', from: base + i, to: base + i + fn[0].length, id: fn[1], raw: fn[0], hide: [[base + i, base + i + fn[0].length]] })
        i += fn[0].length; continue
      }
      const m = /^\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+["']([^"']*)["'])?\s*\)/.exec(rest)
      if (m) {
        const end = m[0].length
        const labelStart = i + 1, labelEnd = labelStart + m[1].length
        push({ type: 'link', from: base + i, to: base + i + end, innerFrom: base + labelStart, innerTo: base + labelEnd, url: m[2], title: m[3], text: m[1], raw: m[0], hide: [...hide(i, labelStart), ...hide(labelEnd, i + end)] })
        i += end; continue
      }
      const ref = /^\[([^\]]+)\]\[([^\]]*)\]/.exec(rest)
      if (ref && opts.footnoteDefs) {
        const id = (ref[2] || ref[1]).toLowerCase()
        if (opts.footnoteDefs.has(id)) {
          const end = ref[0].length
          push({ type: 'link', from: base + i, to: base + i + end, innerFrom: base + i + 1, innerTo: base + i + 1 + ref[1].length, url: '#fn:' + id, text: ref[1], raw: ref[0], hide: [...hide(i, i + 1), ...hide(i + 1 + ref[1].length, i + end)] })
          i += end; continue
        }
      }
    }

    if (ch === '<') {
      const m = /^<((?:https?|ftp):\/\/[^>\s]+)>/.exec(rest) || /^<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/.exec(rest)
      if (m) {
        const end = m[0].length
        const innerFrom = i + 1, innerTo = i + 1 + m[1].length
        push({ type: 'autolink', from: base + i, to: base + i + end, innerFrom: base + innerFrom, innerTo: base + innerTo, url: m[1].includes('@') ? 'mailto:' + m[1] : m[1], text: m[1], raw: m[0], hide: [...hide(i, innerFrom), ...hide(innerTo, i + end)] })
        i += end; continue
      }
      if (opts.html !== false) {
        const cm = /^<!--[\s\S]*?-->/.exec(rest)
        if (cm) { push({ type: 'html_comment', from: base + i, to: base + i + cm[0].length, raw: cm[0], hide: [[base + i, base + i + cm[0].length]] }); i += cm[0].length; continue }
        const tm = /^<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/.exec(rest)
        if (tm && !/^<(?:br|hr|img|input|meta|link)\b/i.test(tm[0])) {
          const end = tm[0].length
          push({ type: tm[0].startsWith('</') ? 'html_close' : 'html_open', from: base + i, to: base + i + end, tag: tm[1].toLowerCase(), attrs: tm[2], raw: tm[0], hide: [[base + i, base + i + end]] })
          i += end; continue
        }
        const br = /^<(br|hr|img)\b([^>]*)>/i.exec(rest)
        if (br) { const end = br[0].length; push({ type: 'html_void', from: base + i, to: base + i + end, tag: br[1].toLowerCase(), attrs: br[2], raw: br[0], hide: [[base + i, base + i + end]] }); i += end; continue }
      }
    }

    if (ch === '$' && src[i + 1] !== ' ' && src[i + 1] !== '\t') {
      let j = i + 1
      while (j < n && src[j] !== '$') { if (src[j] === '\\') j++; j++ }
      if (j < n && j > i + 1 && !/\s/.test(src[i + 1])) {
        push({ type: 'math', from: base + i, to: base + j + 1, raw: src.slice(i, j + 1), text: src.slice(i + 1, j), hide: [[base + i, base + j + 1]] })
        i = j + 1; continue
      }
    }
    if (opts.latexDelimiters !== false) {
      if (ch === '\\' && src[i + 1] === '(') {
        const close = src.indexOf('\\)', i + 2)
        if (close > i + 2) { push({ type: 'math', from: base + i, to: base + close + 2, raw: src.slice(i, close + 2), text: src.slice(i + 2, close), hide: [[base + i, base + close + 2]] }); i = close + 2; continue }
      }
      if (ch === '\\' && src[i + 1] === '[') {
        const close = src.indexOf('\\]', i + 2)
        if (close > i + 2) { push({ type: 'math', from: base + i, to: base + close + 2, raw: src.slice(i, close + 2), text: src.slice(i + 2, close), hide: [[base + i, base + close + 2]] }); i = close + 2; continue }
      }
    }

    if (ch === '*' || ch === '_') {
      const delim = ch
      const de = ch === '*' ? '\\*' : ch
      const triple = rest.slice(0, 3) === delim.repeat(3)
      const dbl = rest.slice(0, 2) === delim.repeat(2)
      if (triple) {
        const m = new RegExp('^' + de + '{3}([\\s\\S]+?)' + de + '{3}').exec(rest)
        if (m && m[1].length) { const end = m[0].length; push({ type: 'strong_em', from: base + i, to: base + i + end, innerFrom: base + i + 3, innerTo: base + i + end - 3, raw: m[0], hide: [...hide(i, i + 3), ...hide(i + end - 3, i + end)] }); i += end; continue }
      }
      if (dbl) {
        const m = new RegExp('^' + de + '{2}([\\s\\S]+?)' + de + '{2}(?!' + de + ')').exec(rest)
        if (m && m[1].length) { const end = m[0].length; push({ type: 'strong', from: base + i, to: base + i + end, innerFrom: base + i + 2, innerTo: base + i + end - 2, raw: m[0], hide: [...hide(i, i + 2), ...hide(i + end - 2, i + end)] }); i += end; continue }
      }
      const m = new RegExp('^' + de + '([\\s\\S]+?)' + de + '(?!' + de + ')').exec(rest)
      if (m && m[1].length) { const end = m[0].length; push({ type: 'em', from: base + i, to: base + i + end, innerFrom: base + i + 1, innerTo: base + i + end - 1, raw: m[0], hide: [...hide(i, i + 1), ...hide(i + end - 1, i + end)] }); i += end; continue }
    }

    if (rest.slice(0, 2) === '~~') {
      const m = /^~~([\s\S]+?)~~/.exec(rest)
      if (m && m[1].length) { const end = m[0].length; push({ type: 'strike', from: base + i, to: base + i + end, innerFrom: base + i + 2, innerTo: base + i + end - 2, raw: m[0], hide: [...hide(i, i + 2), ...hide(i + end - 2, i + end)] }); i += end; continue }
    }

    if (opts.highlight && rest.slice(0, 2) === '==') {
      const m = /^==([\s\S]+?)==/.exec(rest)
      if (m && m[1].length) { const end = m[0].length; push({ type: 'highlight', from: base + i, to: base + i + end, innerFrom: base + i + 2, innerTo: base + i + end - 2, raw: m[0], hide: [...hide(i, i + 2), ...hide(i + end - 2, i + end)] }); i += end; continue }
    }

    if (opts.superscript && ch === '^') {
      const m = /^\^([^\s^]+)\^?/.exec(rest)
      if (m && m[1]) { const end = m[0].length; push({ type: 'sup', from: base + i, to: base + i + end, innerFrom: base + i + 1, innerTo: base + i + 1 + m[1].length, raw: m[0], hide: [...hide(i, i + 1), ...hide(i + 1 + m[1].length, i + end)] }); i += end; continue }
    }

    if (opts.subscript && ch === '~' && src[i + 1] !== '~') {
      const m = /^~([^\s~]+)~?/.exec(rest)
      if (m && m[1]) { const end = m[0].length; push({ type: 'sub', from: base + i, to: base + i + end, innerFrom: base + i + 1, innerTo: base + i + 1 + m[1].length, raw: m[0], hide: [...hide(i, i + 1), ...hide(i + 1 + m[1].length, i + end)] }); i += end; continue }
    }

    if (opts.emoji !== false && ch === ':') {
      const m = /^:([a-zA-Z0-9_+-]+):/.exec(rest)
      if (m && emojiFor(m[1])) {
        push({ type: 'emoji', from: base + i, to: base + i + m[0].length, emoji: emojiFor(m[1]), raw: m[0], hide: [[base + i, base + i + m[0].length]] })
        i += m[0].length; continue
      }
    }

    if (opts.autolink !== false && /[a-zA-Z]/.test(ch)) {
      const m = /^(https?:\/\/[^\s<>()\[\]]+)/.exec(rest)
      if (m) { const end = m[0].length; push({ type: 'autolink', from: base + i, to: base + i + end, innerFrom: base + i, innerTo: base + i + end, url: m[1], text: m[1], raw: m[0] }); i += end; continue }
    }

    if (ch === ' ' && src[i + 1] === ' ' && (src[i + 2] === '\n' || i + 2 >= n)) {
      push({ type: 'break', from: base + i, to: base + i + 2, hide: [[base + i, base + i + 2]] })
      i += 2; continue
    }

    i++
  }
  return tokens
}

export function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '')
}

export function extractOutline(text: string): OutlineItem[] {
  const blocks = parseBlocks(text)
  const used: Record<string, number> = {}
  const out: OutlineItem[] = []
  for (const b of blocks) {
    if (b.type !== 'heading' || b.level == null) continue
    const rawText = stripInline(b.text ?? '')
    let id = slugify(rawText) || 'section'
    if (used[id] != null) { used[id]++; id = id + '-' + used[id] } else used[id] = 0
    out.push({ level: b.level, text: rawText, line: b.fromLine, from: b.from, id })
  }
  return out
}

export function extractFootnotes(text: string): Map<string, string> {
  const map = new Map<string, string>()
  const re = new RegExp('^\\[\\^([^\\]]+)\\]:\\s?([\\s\\S]*?)(?=\\n\\s*\\n|\\n\\[\\^|\\s*$)', 'gm')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) map.set(m[1].toLowerCase(), m[2].trim().replace(/\n\s*/g, ' '))
  return map
}

export function tableToRaw(header: string[], align: Array<'left'|'center'|'right'|null>, rows: string[][]): string {
  const fmt = (cells: string[]) => '| ' + cells.join(' | ') + ' |'
  const delim = '| ' + align.map(a => a === 'center' ? ':---:' : a === 'right' ? '---:' : a === 'left' ? ':---' : '---').join(' | ') + ' |'
  return [fmt(header), delim, ...rows.map(fmt)].join('\n')
}

export function parseTableRaw(raw: string): { header: string[]; align: Array<'left'|'center'|'right'|null>; rows: string[][] } | null {
  const blocks = parseBlocks(raw)
  const t = blocks.find(b => b.type === 'table')
  if (!t) return null
  return { header: t.header ?? [], align: t.align ?? [], rows: t.rows ?? [] }
}

export function stripInline(text: string): string {
  const btRe = new RegExp(BT + '([^' + BT + ']*)' + BT, 'g')
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(btRe, '$1')
    .replace(/\*\*?([^*]*)\*\*?/g, '$1')
    .replace(/~~([^~]*)~~/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .trim()
}

export function wordCount(text: string): { words: number; chars: number; lines: number } {
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const nonCjk = text.replace(/[\u4e00-\u9fa5]/g, ' ')
  const words = (nonCjk.match(/[A-Za-z0-9_'-]+/g) || []).length + cjk
  return { words, chars: text.length, lines: text.split(/\r\n|\r|\n/).length }
}

export function isMarkdownFile(name: string): boolean {
  return /\.(md|markdown|mmd|mkd|mdwn|mdown|mdx|mdtxt|mdtext|apib|rmarkdown|rmd|qmd|txt|text)$/i.test(name)
}