
import MarkdownIt from 'markdown-it'
import { escapeHtml, highlightCode, renderMath, renderMermaid, resolveAsset } from './render'
import { DEFAULT_CSS, themeCss } from './theme/theme'
import { extractOutline, extractFootnotes, stripInline, slugify } from './editor/kernel'

export interface ExportRenderOptions {
  docDir: string
  theme: string
  dark: boolean
  mathMode: 'svg' | 'latex'
  pageBreak?: boolean
}

export interface ExportResult {
  html: string
  body?: string
  bookmarks: Array<{ title: string; id: string; level: number }>
}

const TOKEN_PREFIX = 'KONAIPLH'

export async function renderExportBody(text: string, opts: ExportRenderOptions): Promise<{ body: string; bookmarks: Array<{ title: string; id: string; level: number }> }> {
  const mathStore: string[] = []
  const merStore: string[] = []
  const fnDefs = extractFootnotes(text)
  const fnOrder: string[] = []
  fnDefs.forEach((_v, k) => fnOrder.push(k))
  const fnIndex: Record<string, number> = {}
  fnOrder.forEach((k, i) => { fnIndex[k] = i + 1 })

  let src = text
  src = src.replace(/^\[\^([^\]]+)\]:\s?[\s\S]*?(?=\n\s*\n|\n\[\^|$)/gm, '')

  src = src.replace(/^([ \t]*\$\$[\s\S]*?\$\$)[ \t]*$/gm, (m) => {
    const tex = m.replace(/^[ \t]*\$\$/, '').replace(/\$\$[ \t]*$/, '').trim()
    mathStore.push(tex)
    return TOKEN_PREFIX + 'M' + (mathStore.length - 1) + TOKEN_PREFIX
  })
  src = src.replace(/(?<!\\)\$([^$\n]+?)\$(?!\d)/g, (m, tex) => {
    mathStore.push(tex)
    return TOKEN_PREFIX + 'M' + (mathStore.length - 1) + TOKEN_PREFIX
  })
  src = src.replace(/^([ \t]*)(\x60{3,}|~{3,})[ \t]*(mermaid|flow|sequence|zenuml|gantt|graph|diagrams)[ \t]*\n([\s\S]*?)\n\1\2[ \t]*$/gm, (m, indent, fence, lang, code) => {
    merStore.push(code)
    return TOKEN_PREFIX + 'D' + (merStore.length - 1) + TOKEN_PREFIX
  })
  src = src.replace(/\[\^([^\]]+)\]/g, (m, id) => {
    const key = id.toLowerCase()
    const n = fnIndex[key] || 0
    return '<sup class="konai-fn-ref" data-id="' + escapeHtml(id) + '">[' + n + ']</sup>'
  })

  const md = new MarkdownIt({ html: true, linkify: true, breaks: false, typographer: false })
  const origHeading = md.renderer.rules.heading_open
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const t = tokens[idx]
    const inline = tokens[idx + 1]
    const raw = inline ? inline.content : ''
    const id = slugify(stripInline(raw)) || 'sec-' + idx
    t.attrSet('id', id)
    t.attrSet('data-konai-bm', '1')
    return origHeading ? origHeading(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
  }
  const origFence = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const t = tokens[idx]
    const info = (t.info || '').trim()
    const lang = info.split(/\s+/)[0] || ''
    const code = t.content.replace(/\n$/, '')
    if (/^(mermaid|flow|sequence|zenuml)$/.test(lang.toLowerCase())) {
      const i = merStore.length
      merStore.push(code)
      return '<div class="konai-diagram" data-diagram="' + i + '">' + TOKEN_PREFIX + 'D' + i + TOKEN_PREFIX + '</div>\n'
    }
    return '<pre class="konai-code"><code class="konai-lang-' + escapeHtml(lang) + '">' + escapeHtml(code) + '</code></pre>\n'
  }
  md.renderer.rules.code_inline = (tokens, idx) => {
    const t = tokens[idx]
    return '<code>' + escapeHtml(t.content) + '</code>'
  }
  const origImage = md.renderer.rules.image
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const t = tokens[idx]
    const srcAttr = t.attrGet('src') || ''
    const alt = t.content || ''
    t.attrSet('src', resolveAsset(String(srcAttr), String(opts.docDir)))
    t.attrSet('alt', alt)
    return origImage ? origImage(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
  }
  const origLinkOpen = md.renderer.rules.link_open
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const t = tokens[idx]
    const href = t.attrGet('href') || ''
    if (/^https?:/i.test(String(href))) { t.attrSet('target', '_blank'); t.attrSet('rel', 'noopener') }
    return origLinkOpen ? origLinkOpen(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
  }

  let body = md.render(src)

  body = body.replace(/<li>\s*\[([ xX])\]\s*/g, (m, c) => '<li class="konai-task-li"><input type="checkbox" disabled' + (c.toLowerCase() === 'x' ? ' checked' : '') + '> ')
  body = body.replace(/<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*?)<\/p>/gi, (m, kind, rest) => {
    return '<blockquote class="konai-alert konai-alert-' + kind.toLowerCase() + '"><p class="konai-alert-label konai-alert-label-' + kind.toLowerCase() + '">' + kind.toUpperCase() + '</p><p>' + rest
  })

  for (let i = 0; i < mathStore.length; i++) {
    const tex = mathStore[i]
    let out = ''
    if (opts.mathMode === 'svg') {
      try {
        const el = await renderMath(tex, true)
        out = '<span class="konai-math konai-math-block">' + el.outerHTML + '</span>'
      } catch { out = '<span class="konai-math-src">\\[' + escapeHtml(tex) + '\\]</span>' }
    } else {
      out = '<span class="konai-math konai-math-block konai-math-src">\\[' + escapeHtml(tex) + '\\]</span>'
    }
    body = body.split(TOKEN_PREFIX + 'M' + i + TOKEN_PREFIX).join(out)
  }
  for (let i = 0; i < merStore.length; i++) {
    const code = merStore[i]
    let out = ''
    try {
      const el = await renderMermaid(code, 'ex' + i, opts.dark ? 'dark' : 'default')
      out = el.outerHTML
    } catch { out = '<pre class="konai-code"><code>' + escapeHtml(code) + '</code></pre>' }
    body = body.split(TOKEN_PREFIX + 'D' + i + TOKEN_PREFIX).join(out)
  }

  if (fnOrder.length) {
    let fns = '<section class="konai-footnotes"><hr><ol>'
    for (const k of fnOrder) {
      fns += '<li id="fn:' + escapeHtml(k) + '">' + escapeHtml(fnDefs.get(k) || '') + '</li>'
    }
    fns += '</ol></section>'
    body += fns
  }

  const outline = extractOutline(text)
  const bookmarks = outline.filter((o) => o.level <= 3).map((o) => ({ title: o.text, id: o.id, level: o.level }))
  return { body, bookmarks }
}

export function buildHtmlDocument(body: string, css: string, title: string, pageBreak: boolean): string {
  const printCss = pageBreak ? '.konai-doc h1 { break-before: page; } .konai-doc h1:first-child { break-before: auto; }' : ''
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + escapeHtml(title) + '</title><style>' + css + '\n' + printCss + '\n.konai-doc { max-width: var(--konai-content-width); margin: 0 auto; padding: 24px 32px 60px; }</style></head><body><div class="konai-doc">' + body + '</div></body></html>'
}

export async function buildExportHtml(text: string, opts: ExportRenderOptions & { title: string; styled: boolean; pageBreak?: boolean }): Promise<ExportResult> {
  const { body, bookmarks } = await renderExportBody(text, opts)
  const css = opts.styled ? DEFAULT_CSS + '\n' + themeCss(opts.theme) : ''
  const html = buildHtmlDocument(body, css, opts.title, !!opts.pageBreak)
  return { html, body, bookmarks }
}

export function exportCss(theme: string): string { return DEFAULT_CSS + '\n' + themeCss(theme) }
