
import { EditorView, WidgetType } from '@codemirror/view'
import { RangeSetBuilder, StateEffect } from '@codemirror/state'
import { Decoration, DecorationSet } from '@codemirror/view'
import { parseBlocks, parseInline, extractFootnotes, Block, InlineToken, tableToRaw, slugify, OutlineItem } from './kernel'
import { escapeHtml, sanitizeHtml, renderMath, renderMermaid, highlightCode, resolveAsset } from '../render'
import { Config } from '@shared/types'

export const setWysiwyg = StateEffect.define<boolean>()

export interface DecoContext {
  config: Config
  docDir: string
  theme: string
  onEditBlock: (block: Block, nextRaw: string) => void
  onToggleTask: (block: Block, from: number, to: number, checked: boolean) => void
  onJumpToLine: (line: number) => void
}

// ---------------- widgets ----------------

class HiddenWidget extends WidgetType {
  eq() { return true }
  toDOM() { const s = document.createElement('span'); s.className = 'cm-konai-hide'; return s }
  ignoreEvent() { return false }
}

class EmojiWidget extends WidgetType {
  constructor(private ch: string) { super() }
  eq(o: any) { return o.ch === this.ch }
  toDOM() { const s = document.createElement('span'); s.className = 'cm-konai-emoji'; s.textContent = this.ch; return s }
}

class MathWidget extends WidgetType {
  private el: HTMLElement | null = null
  constructor(private tex: string, private display: boolean, private theme: string) { super() }
  eq(o: any) { return o.tex === this.tex && o.display === this.display && o.theme === this.theme }
  toDOM() {
    const host = document.createElement(this.display ? 'div' : 'span')
    host.className = this.display ? 'cm-konai-math cm-konai-math-block' : 'cm-konai-math cm-konai-math-inline'
    host.dataset.tex = this.tex
    renderMath(this.tex, this.display).then((el) => { if (host.isConnected) { host.replaceChildren(el); this.el = el } else { host.replaceChildren(el) } }).catch(() => { host.textContent = this.tex })
    return host
  }

}

class MermaidWidget extends WidgetType {
  constructor(private code: string, private theme: string) { super() }
  eq(o: any) { return o.code === this.code && o.theme === this.theme }
  toDOM() {
    const host = document.createElement('div')
    host.className = 'cm-konai-mermaid'
    const id = Math.abs(hash(this.code)).toString(36)
    renderMermaid(this.code, id, this.theme).then((el) => host.replaceChildren(el)).catch(() => { host.textContent = this.code })
    return host
  }

  ignoreEvent() { return true }
}

class CodeBlockWidget extends WidgetType {
  constructor(private code: string, private lang: string, private lineNumbers: boolean) { super() }
  eq(o: any) { return o.code === this.code && o.lang === this.lang && o.lineNumbers === this.lineNumbers }
  toDOM() {
    const host = document.createElement('div')
    host.className = 'cm-konai-code'
    host.innerHTML = '<div class="cm-konai-code-bar"><span class="cm-konai-code-lang">' + escapeHtml(this.lang || 'text') + '</span><button class="cm-konai-code-copy" type="button">复制</button></div>' + highlightCode(this.code.replace(/\n$/, ''), this.lang, this.lineNumbers)
    const btn = host.querySelector('.cm-konai-code-copy')
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); navigator.clipboard?.writeText(this.code) })
    return host
  }

  ignoreEvent() { return true }
}

class TableWidget extends WidgetType {
  constructor(private block: Block, private docDir: string, private onEdit: (b: Block, raw: string) => void) { super() }
  eq(o: any) { return o.block.raw === this.block.raw }
  toDOM() {
    const host = document.createElement('div')
    host.className = 'cm-konai-table'
    host.innerHTML = tableHtml(this.block)
    const table = host.querySelector('table') as HTMLTableElement | null
    const toolbar = document.createElement('div')
    toolbar.className = 'cm-konai-table-bar'
    toolbar.innerHTML = '<button data-act="row-before" title="上方插入行">+行</button><button data-act="row-after" title="下方插入行">+行</button><button data-act="col-before" title="左侧插入列">+列</button><button data-act="col-after" title="右侧插入列">+列</button><button data-act="del-row" title="删除行">-行</button><button data-act="del-col" title="删除列">-列</button><button data-act="left">左</button><button data-act="center">中</button><button data-act="right">右</button><button data-act="source">源码</button>'
    host.appendChild(toolbar)

    let sel: { r: number; c: number } | null = null
    const mark = () => {
      host.querySelectorAll('td,th').forEach((c) => c.classList.remove('cm-konai-cell-sel'))
      if (sel) { const cell = cellAt(table, sel.r, sel.c); if (cell) cell.classList.add('cm-konai-cell-sel') }
    }
    const cellAt = (t: HTMLTableElement | null, r: number, c: number): HTMLElement | null => {
      if (!t) return null
      const tr = r === 0 ? t.tHead?.rows[0] : t.tBodies[0]?.rows[r - 1]
      return tr?.cells[c] ?? null
    }
    host.addEventListener('click', (e) => {
      const cell = (e.target as HTMLElement).closest('td,th') as HTMLElement | null
      if (cell && table) {
        const tr = cell.parentElement as HTMLTableRowElement
        const r = tr.parentElement?.tagName === 'THEAD' ? 0 : 1 + (tr.rowIndex - (table.tHead ? table.tHead.rows.length : 0))
        sel = { r, c: (cell as HTMLTableCellElement).cellIndex }
        mark()
      }
    })
    host.addEventListener('input', (e) => {
      const cell = (e.target as HTMLElement).closest('td,th') as HTMLElement | null
      if (!cell) return
      commit()
    })
    const commit = () => {
      if (!table) return
      const header = Array.from(table.tHead?.rows[0]?.cells || []).map((c) => c.textContent || '')
      const rows = Array.from(table.tBodies[0]?.rows || []).map((tr) => Array.from(tr.cells).map((c) => c.textContent || ''))
      this.onEdit(this.block, tableToRaw(header, this.block.align || [], rows))
    }
    toolbar.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.getAttribute('data-act')
      if (!act || !table) return
      if (act === 'source') { this.onEdit(this.block, this.block.raw); return }
      const cur = sel || { r: 0, c: 0 }
      if (act === 'row-before' || act === 'row-after') {
        const idx = act === 'row-before' ? cur.r : cur.r + 1
        const cols = headerCount(table)
        const tr = table.tBodies[0].insertRow(Math.max(0, idx - 1))
        for (let i = 0; i < cols; i++) { const td = tr.insertCell(i); td.contentEditable = 'true'; td.textContent = '' }
      } else if (act === 'col-before' || act === 'col-after') {
        const idx = act === 'col-before' ? cur.c : cur.c + 1
        addCol(table, idx)
      } else if (act === 'del-row') {
        const body = table.tBodies[0]
        if (body.rows.length > 1) body.deleteRow(Math.min(cur.r - 1, body.rows.length - 1))
      } else if (act === 'del-col') {
        const cols = headerCount(table)
        if (cols > 1) { for (const tr of allRows(table)) tr.deleteCell(Math.min(cur.c, tr.cells.length - 1)) }
      } else if (act === 'left' || act === 'center' || act === 'right') {
        if (sel) {
          const a = act === 'left' ? 'left' : act === 'center' ? 'center' : 'right'
          const align = (this.block.align || []).slice()
          align[sel.c] = a
          this.onEdit(this.block, tableToRaw(readHeader(table), align, readRows(table)))
        }
      }
      host.innerHTML = tableHtmlFrom(table)
      host.appendChild(toolbar)
    })
    return host
  }

  ignoreEvent() { return true }
}

function headerCount(t: HTMLTableElement): number { return t.tHead?.rows[0]?.cells.length || t.tBodies[0]?.rows[0]?.cells.length || 1 }
function allRows(t: HTMLTableElement): HTMLTableRowElement[] {
  const rows: HTMLTableRowElement[] = []
  if (t.tHead) rows.push(...Array.from(t.tHead.rows))
  for (const b of Array.from(t.tBodies)) rows.push(...Array.from(b.rows))
  return rows
}
function readHeader(t: HTMLTableElement): string[] { return Array.from(t.tHead?.rows[0]?.cells || []).map((c) => c.textContent || '') }
function readRows(t: HTMLTableElement): string[][] { return Array.from(t.tBodies[0]?.rows || []).map((tr) => Array.from(tr.cells).map((c) => c.textContent || '')) }
function addCol(t: HTMLTableElement, idx: number) {
  for (const tr of allRows(t)) { const cell = tr.insertCell(Math.min(idx, tr.cells.length)); cell.contentEditable = 'true'; cell.textContent = '' }
}
function tableHtml(b: Block): string {
  const header = b.header || []
  const align = b.align || []
  const rows = b.rows || []
  let h = '<div class="cm-konai-table-scroll"><table><thead><tr>'
  header.forEach((c, i) => { h += '<th contenteditable="true" data-a="' + (align[i] || '') + '" style="text-align:' + (align[i] || 'left') + '">' + inlineHtml(c) + '</th>' })
  h += '</tr></thead><tbody>'
  for (const r of rows) {
    h += '<tr>'
    r.forEach((c, i) => { h += '<td contenteditable="true" style="text-align:' + (align[i] || 'left') + '">' + inlineHtml(c) + '</td>' })
    h += '</tr>'
  }
  h += '</tbody></table></div>'
  return h
}
function tableHtmlFrom(t: HTMLTableElement): string {
  const header = readHeader(t)
  const align = Array.from(t.tHead?.rows[0]?.cells || []).map((c) => (c as HTMLElement).dataset.a || '')
  let h = '<div class="cm-konai-table-scroll"><table><thead><tr>'
  header.forEach((c, i) => { h += '<th contenteditable="true" data-a="' + (align[i] || '') + '" style="text-align:' + (align[i] || 'left') + '">' + escapeHtml(c) + '</th>' })
  h += '</tr></thead><tbody>'
  for (const r of readRows(t)) { h += '<tr>'; r.forEach((c, i) => { h += '<td contenteditable="true" style="text-align:' + (align[i] || 'left') + '">' + escapeHtml(c) + '</td>' }); h += '</tr>' }
  h += '</tbody></table></div>'
  return h
}

function inlineHtml(text: string): string {
  const toks = parseInline(text, 0)
  let out = ''
  let pos = 0
  for (const t of toks) {
    out += escapeHtml(text.slice(pos, t.from))
    const inner = text.slice(t.innerFrom ?? t.from, t.innerTo ?? t.to)
    if (t.type === 'strong') out += '<strong>' + escapeHtml(inner) + '</strong>'
    else if (t.type === 'em') out += '<em>' + escapeHtml(inner) + '</em>'
    else if (t.type === 'strong_em') out += '<strong><em>' + escapeHtml(inner) + '</em></strong>'
    else if (t.type === 'strike') out += '<del>' + escapeHtml(inner) + '</del>'
    else if (t.type === 'code') out += '<code>' + escapeHtml(inner) + '</code>'
    else if (t.type === 'link') out += '<a>' + escapeHtml(inner) + '</a>'
    else out += escapeHtml(text.slice(t.from, t.to))
    pos = t.to
  }
  out += escapeHtml(text.slice(pos))
  return out
}

class ImageWidget extends WidgetType {
  constructor(private src: string, private alt: string, private title: string, private docDir: string, private block: boolean) { super() }
  eq(o: any) { return o.src === this.src && o.alt === this.alt && o.docDir === this.docDir }
  toDOM() {
    const img = document.createElement('img')
    img.className = this.block ? 'cm-konai-img cm-konai-img-block' : 'cm-konai-img'
    img.src = resolveAsset(this.src, this.docDir)
    img.alt = this.alt || ''
    if (this.title) img.title = this.title
    img.loading = 'lazy'
    return img
  }

}

class TocWidget extends WidgetType {
  constructor(private items: OutlineItem[], private onJump: (line: number) => void) { super() }
  eq(o: any) { return o.items === this.items }
  toDOM() {
    const host = document.createElement('div')
    host.className = 'cm-konai-toc'
    if (!this.items.length) { host.innerHTML = '<div class="cm-konai-toc-empty">无标题</div>'; return host }
    const ul = document.createElement('ul')
    for (const it of this.items) {
      const li = document.createElement('li')
      li.className = 'cm-konai-toc-item cm-konai-toc-h' + it.level
      const a = document.createElement('a')
      a.textContent = it.text
      a.addEventListener('click', () => this.onJump(it.line))
      li.appendChild(a)
      ul.appendChild(li)
    }
    host.appendChild(ul)
    return host
  }

}

class HtmlBlockWidget extends WidgetType {
  constructor(private html: string) { super() }
  eq(o: any) { return o.html === this.html }
  toDOM() {
    const host = document.createElement('div')
    host.className = 'cm-konai-html'
    host.innerHTML = sanitizeHtml(this.html)
    return host
  }

  ignoreEvent() { return true }
}

class MediaWidget extends WidgetType {
  constructor(private kind: string, private code: string, private theme: string) { super() }
  eq(o: any) { return o.kind === this.kind && o.code === this.code && o.theme === this.theme }
  toDOM() {
    if (this.kind === 'zenuml' || this.kind === 'sequence' || this.kind === 'flow') {
      const host = document.createElement('div')
      host.className = 'cm-konai-mermaid'
      renderMermaid(this.code, Math.abs(hash(this.code)).toString(36), this.theme).then((el) => host.replaceChildren(el)).catch(() => { host.textContent = this.code })
      return host
    }
    const host = document.createElement('div')
    host.className = 'cm-konai-mermaid'
    renderMermaid(this.code, Math.abs(hash(this.code)).toString(36), this.theme).then((el) => host.replaceChildren(el)).catch(() => { host.textContent = this.code })
    return host
  }

  ignoreEvent() { return true }
}

class HrWidget extends WidgetType {
  eq() { return true }
  toDOM() { const d = document.createElement('div'); d.className = 'cm-konai-hr'; return d }

}

class FrontmatterWidget extends WidgetType {
  constructor(private raw: string) { super() }
  eq(o: any) { return o.raw === this.raw }
  toDOM() {
    const d = document.createElement('div')
    d.className = 'cm-konai-frontmatter'
    d.textContent = 'YAML Front Matter'
    d.title = this.raw
    return d
  }

}

class FootnoteWidget extends WidgetType {
  constructor(private id: string, private text: string) { super() }
  eq(o: any) { return o.id === this.id && o.text === this.text }
  toDOM() {
    const d = document.createElement('div')
    d.className = 'cm-konai-footnote'
    d.innerHTML = '<sup class="cm-konai-footnote-id">[' + escapeHtml(this.id) + ']</sup> ' + escapeHtml(this.text)
    return d
  }

}

class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean, private onToggle: () => void) { super() }
  eq(o: any) { return o.checked === this.checked }
  toDOM() {
    const label = document.createElement('label')
    label.className = 'cm-konai-task'
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = this.checked
    cb.addEventListener('click', (e) => { e.stopPropagation(); this.onToggle() })
    cb.addEventListener('change', (e) => e.stopPropagation())
    label.appendChild(cb)
    return label
  }
  ignoreEvent() { return true }
}

class ListMarkerWidget extends WidgetType {
  constructor(private marker: string) { super() }
  eq(o: any) { return o.marker === this.marker }
  toDOM() { const s = document.createElement('span'); s.className = 'cm-konai-marker'; s.textContent = this.marker; return s }
}

// ---------------- decoration builder ----------------

export function buildDecorations(state: any, ctx: DecoContext): DecorationSet {
  const decos: Array<{ from: number; to: number; deco: Decoration }> = []
  const text = state.doc.toString()
  const blocks = parseBlocks(text)
  const fnDefs = extractFootnotes(text)
  const cfg = ctx.config
  const inlineOpts = {
    highlight: !!cfg.highlight, superscript: !!cfg.superscript, subscript: !!cfg.subscript,
    emoji: cfg.emoji !== false, latexDelimiters: cfg.latexDelimiters !== false, autolink: true, html: true,
    footnoteDefs: fnDefs,
  }
  const doc = state.doc
  const add = (from: number, to: number, deco: Decoration) => { if (from < to) decos.push({ from, to, deco }) }
  const addHide = (from: number, to: number) => { if (from < to) decos.push({ from, to, deco: Decoration.replace({ widget: new HiddenWidget(), inclusive: false }) }) }
  const addLine = (from: number, cls: string) => { decos.push({ from, to: from, deco: Decoration.line({ class: cls }) }) }

  const addInline = (from: number, to: number) => {
    const src = text.slice(from, to)
    const toks = parseInline(src, from, inlineOpts).sort((a, b) => a.from - b.from)
    let cursor = from
    for (const t of toks) {
      if (t.from < cursor) continue
      cursor = t.to
      const wholeWidget = t.type === 'math' || t.type === 'image' || t.type === 'emoji' || t.type === 'footnote' || t.type === 'html_void'
      if (t.hide && !wholeWidget) for (const [hf, ht] of t.hide) addHide(hf, ht)
      const innerFrom = t.innerFrom ?? t.from
      const innerTo = t.innerTo ?? t.to
      if (t.type === 'strong' || t.type === 'strong_em') add(innerFrom, innerTo, Decoration.mark({ class: 'cm-konai-strong' + (t.type === 'strong_em' ? ' cm-konai-em' : '') }))
      else if (t.type === 'em') add(innerFrom, innerTo, Decoration.mark({ class: 'cm-konai-em' }))
      else if (t.type === 'strike') add(innerFrom, innerTo, Decoration.mark({ class: 'cm-konai-strike' }))
      else if (t.type === 'highlight') add(innerFrom, innerTo, Decoration.mark({ class: 'cm-konai-highlight' }))
      else if (t.type === 'code') add(innerFrom, innerTo, Decoration.mark({ class: 'cm-konai-code' }))
      else if (t.type === 'sup') add(innerFrom, innerTo, Decoration.mark({ class: 'cm-konai-sup' }))
      else if (t.type === 'sub') add(innerFrom, innerTo, Decoration.mark({ class: 'cm-konai-sub' }))
      else if (t.type === 'link' || t.type === 'autolink') add(innerFrom, innerTo, Decoration.mark({ class: 'cm-konai-link' }))
      else if (t.type === 'footnote') add(t.from, t.to, Decoration.replace({ widget: new FootnoteRefWidget(t.id || ''), inclusive: false }))
      else if (t.type === 'emoji') add(t.from, t.to, Decoration.replace({ widget: new EmojiWidget(t.emoji || ''), inclusive: false }))
      else if (t.type === 'math') add(t.from, t.to, Decoration.replace({ widget: new MathWidget(t.text || '', false, ctx.theme), inclusive: false }))
      else if (t.type === 'image') add(t.from, t.to, Decoration.replace({ widget: new ImageWidget(t.url || '', t.alt || '', t.title || '', ctx.docDir, false), inclusive: false }))
      else if (t.type === 'html_open' || t.type === 'html_close') addHide(t.from, t.to)
      else if (t.type === 'html_void') add(t.from, t.to, Decoration.replace({ widget: new HtmlVoidWidget(t.tag || '', t.attrs || '', ctx.docDir), inclusive: false }))
      else if (t.type === 'break') addHide(t.from, t.to)
    }
  }

  for (const b of blocks) {
    const lineFrom = doc.line(b.fromLine + 1).from
    const lineTo = doc.line(b.toLine + 1).to
    switch (b.type) {
      case 'frontmatter':
        add(lineFrom, lineTo, Decoration.replace({ block: true, widget: new FrontmatterWidget(b.raw) }))
        break
      case 'heading': {
        const ln = doc.line(b.fromLine + 1)
        const m = ln.text.match(/^(#{1,6})([ \t]+)/)
        const contentFrom = m ? ln.from + m[0].length : ln.from
        const trail = ln.text.match(/[ \t]+#+[ \t]*$/)
        const contentTo = trail ? ln.to - trail[0].length : ln.to
        addLine(ln.from, 'cm-konai-h cm-konai-h' + (b.level || 1))
        for (let l = b.fromLine + 1; l <= b.toLine; l++) addHide(doc.line(l + 1).from, doc.line(l + 1).to)
        addHide(ln.from, contentFrom)
        addHide(contentTo, ln.to)
        addInline(contentFrom, contentTo)
        break
      }
      case 'paragraph': {
        const onlyImage = isOnlyImage(b.raw)
        if (onlyImage) add(lineFrom, lineTo, Decoration.replace({ block: true, widget: new ImageWidget(imageSrc(b.raw), imageAlt(b.raw), '', ctx.docDir, true) }))
        else addInline(lineFrom, lineTo)
        break
      }
      case 'hr':
        add(lineFrom, lineTo, Decoration.replace({ block: true, widget: new HrWidget() }))
        break
      case 'fence':
        add(lineFrom, lineTo, Decoration.replace({ block: true, widget: new CodeBlockWidget(b.code || '', b.lang || '', !!cfg.codeLineNumbers) }))
        break
      case 'math':
        add(lineFrom, lineTo, Decoration.replace({ block: true, widget: new MathWidget(b.math || '', true, ctx.theme) }))
        break
      case 'media':
        add(lineFrom, lineTo, Decoration.replace({ block: true, widget: new MediaWidget(b.url || 'mermaid', b.diagram || b.code || '', ctx.theme) }))
        break
      case 'table':
        add(lineFrom, lineTo, Decoration.replace({ block: true, widget: new TableWidget(b, ctx.docDir, (blk, raw) => ctx.onEditBlock(blk, raw)) }))
        break
      case 'html':
        add(lineFrom, lineTo, Decoration.replace({ block: true, widget: new HtmlBlockWidget(b.raw) }))
        break
      case 'toc':
        add(lineFrom, lineTo, Decoration.replace({ block: true, widget: new TocWidget(outlineOf(text), (ln) => ctx.onJumpToLine(ln)) }))
        break
      case 'footnote':
        add(lineFrom, lineTo, Decoration.replace({ block: true, widget: new FootnoteWidget(b.lang || '', b.text || '') }))
        break
      case 'alert': {
        for (let ln = b.fromLine; ln <= b.toLine; ln++) {
          const L = doc.line(ln + 1)
          const qm = L.text.match(/^(\s*(?:>\s?)+)/)
          const cf = L.from + (qm ? qm[0].length : 0)
          addLine(L.from, 'cm-konai-alert cm-konai-alert-' + (b.alert || 'NOTE').toLowerCase())
          addHide(L.from, cf)
        }
        const first = doc.line(b.fromLine + 1)
        const am = first.text.match(/^(\s*>\s?)\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i)
        if (am) add(first.from + am[1].length, first.from + am[0].length, Decoration.replace({ widget: new AlertLabelWidget((b.alert || 'NOTE')), inclusive: false }))
        for (let ln = b.fromLine; ln <= b.toLine; ln++) {
          const L = doc.line(ln + 1)
          const m = L.text.match(/^\s*(?:>\s?)+/)
          addInline(L.from + (m ? m[0].length : 0), L.to)
        }
        break
      }
      case 'blockquote': {
        for (let ln = b.fromLine; ln <= b.toLine; ln++) {
          const L = doc.line(ln + 1)
          const qm = L.text.match(/^(\s*>\s?)/)
          const cf = L.from + (qm ? qm[0].length : 0)
          addLine(L.from, 'cm-konai-quote')
          addHide(L.from, cf)
          addInline(cf, L.to)
        }
        break
      }
      case 'list': {
        for (let ln = b.fromLine; ln <= b.toLine; ln++) {
          const L = doc.line(ln + 1)
          const lm = L.text.match(/^(\s*)([-*+]|\d{1,9}[.)])([ \t]+)/)
          if (lm) {
            const marker = lm[2] + ' '
            add(L.from + lm[1].length, L.from + lm[1].length + lm[2].length, Decoration.replace({ widget: new ListMarkerWidget(marker), inclusive: false }))
            const after = L.from + lm[0].length
            const task = L.text.slice(lm[0].length).match(/^\[([ xX])\]\s+/)
            if (task) {
              const checked = task[1].toLowerCase() === 'x'
              const tf = L.from + lm[0].length
              const tt = tf + task[0].length
              add(tf, tt, Decoration.replace({ widget: new CheckboxWidget(checked, () => ctx.onToggleTask(b, tf, tt, !checked)), inclusive: false }))
              addInline(tt, L.to)
            } else {
              addInline(after, L.to)
            }
          } else {
            addInline(L.from, L.to)
          }
        }
        break
      }
      default:
        addInline(lineFrom, lineTo)
    }
  }

  decos.sort((a, b) => (a.from - b.from) || (((a.deco as any).startSide ?? 0) - ((b.deco as any).startSide ?? 0)) || (a.to - b.to))
  const builder = new RangeSetBuilder<Decoration>()
  for (const d of decos) builder.add(d.from, d.to, d.deco)
  return builder.finish() as DecorationSet
}

class FootnoteRefWidget extends WidgetType {
  constructor(private id: string) { super() }
  eq(o: any) { return o.id === this.id }
  toDOM() { const s = document.createElement('sup'); s.className = 'cm-konai-footnote-ref'; s.textContent = '[?' + this.id + ']'; return s }
}

class AlertLabelWidget extends WidgetType {
  constructor(private kind: string) { super() }
  eq(o: any) { return o.kind === this.kind }
  toDOM() { const s = document.createElement('span'); s.className = 'cm-konai-alert-label cm-konai-alert-label-' + this.kind.toLowerCase(); s.textContent = this.kind; return s }
}

class HtmlVoidWidget extends WidgetType {
  constructor(private tag: string, private attrs: string, private docDir: string) { super() }
  eq(o: any) { return o.tag === this.tag && o.attrs === this.attrs }
  toDOM() {
    if (this.tag === 'img') {
      const src = attr(this.attrs, 'src') || ''
      const img = document.createElement('img')
      img.src = resolveAsset(src, this.docDir)
      img.alt = attr(this.attrs, 'alt') || ''
      return img
    }
    if (this.tag === 'br') { return document.createElement('br') }
    if (this.tag === 'hr') { const d = document.createElement('div'); d.className = 'cm-konai-hr'; return d }
    const s = document.createElement('span'); s.className = 'cm-konai-hide'; return s
  }
}

function attr(attrs: string, name: string): string {
  const m = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i').exec(attrs) || new RegExp(name + "\\s*=\\s*'([^']*)'", 'i').exec(attrs)
  return m ? m[1] : ''
}

function outlineOf(text: string): OutlineItem[] {
  const blocks = parseBlocks(text)
  const out: OutlineItem[] = []
  for (const b of blocks) {
    if (b.type === 'heading' && b.level != null) {
      out.push({ level: b.level, text: (b.text || '').replace(/^[#\s]+/, ''), line: b.fromLine, from: b.from, id: slugify(b.text || '') })
    }
  }
  return out
}

function isOnlyImage(raw: string): boolean {
  const t = raw.trim()
  return /^!\[[^\]]*\]\([^)]*\)$/.test(t)
}
function imageSrc(raw: string): string { const m = /^!\[[^\]]*\]\(\s*([^\s)]+)/.exec(raw.trim()); return m ? m[1] : '' }
function imageAlt(raw: string): string { const m = /^!\[([^\]]*)\]/.exec(raw.trim()); return m ? m[1] : '' }

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0 }
  return h
}