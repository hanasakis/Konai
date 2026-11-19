
import { BrowserWindow, app, shell } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { PDFDocument, PDFName, PDFArray, PDFRef, PDFHexString } from 'pdf-lib'
import { ExportPdfOptions, ExportDocxOptions, ExportImageOptions } from '@shared/types'

const execFileP = promisify(execFile)

export function ensureDir(p: string): void { mkdirSync(p, { recursive: true }) }

export function writeTextFile(path: string, content: string): void {
  ensureDir(join(path, '..'))
  writeFileSync(path, content, 'utf8')
}

const PAGE_IN: Record<string, { width: number; height: number }> = {
  A4: { width: 8.27, height: 11.69 }, A3: { width: 11.69, height: 16.54 }, A5: { width: 5.83, height: 8.27 },
  Letter: { width: 8.5, height: 11 }, Legal: { width: 8.5, height: 14 }, Tabloid: { width: 11, height: 17 },
}

export async function printPdf(htmlPath: string, opts: ExportPdfOptions, bookmarks: Array<{ title: string; page: number }>): Promise<{ path: string; warnings: string[] }> {
  const warnings: string[] = []
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, contextIsolation: true } })
  try {
    await win.loadFile(htmlPath)
    await new Promise((r) => setTimeout(r, 250))
    const page = PAGE_IN[opts.pageSize] || PAGE_IN.A4
    const mt = (opts.margin.top || 0) / 25.4
    const mb = (opts.margin.bottom || 0) / 25.4
    const ml = (opts.margin.left || 0) / 25.4
    const mr = (opts.margin.right || 0) / 25.4
    let marks: Array<{ title: string; page: number }> = []
    try {
      const dom = await win.webContents.executeJavaScript('(() => { const out = []; document.querySelectorAll("[data-konai-bm]").forEach(function (e) { var r = e.getBoundingClientRect(); out.push({ t: (e.textContent || "").trim(), y: r.top + (window.scrollY || 0) }); }); return JSON.stringify(out); })()') as string
      const items = JSON.parse(dom || '[]') as Array<{ t: string; y: number }>
      const contentH = Math.max(1, (page.height - mt - mb) * 96)
      marks = items.filter((i) => i.t).map((i) => ({ title: i.t, page: Math.min(100000, Math.max(1, Math.floor(i.y / contentH) + 1)) }))
    } catch { marks = bookmarks || [] }
    const header = opts.header ? templateHtml(opts.header, opts.title) : ''
    const footer = opts.footer ? templateHtml(opts.footer, opts.title) : ''
    const data = await win.webContents.printToPDF({
      pageSize: opts.pageSize as any,
      printBackground: !!opts.printBackground,
      margins: { top: mt, bottom: mb, left: ml, right: mr },
      headerTemplate: header || '<span></span>',
      footerTemplate: footer || '<span></span>',
      displayHeaderFooter: !!(header || footer),
      preferCSSPageSize: false,
    } as any)
    let bytes: Uint8Array = data
    if (opts.bookmarks && marks.length) {
      try { bytes = await attachBookmarks(bytes, marks) } catch (e) { warnings.push('Failed to attach bookmark for PDF file.') }
    }
    ensureDir(join(opts.path, '..'))
    writeFileSync(opts.path, bytes)
    return { path: opts.path, warnings }
  } finally {
    win.destroy()
  }
}

function templateHtml(t: string, title: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const body = t
    .replace(/\{\{page\}\}/g, '<span class="pageNumber"></span>')
    .replace(/\{\{total\}\}/g, '<span class="totalPages"></span>')
    .replace(/\{\{title\}\}/g, esc(title))
    .replace(/\{\{date\}\}/g, new Date().toISOString().slice(0, 10))
  return '<div style="font-size:9px;width:100%;padding:0 6mm;display:flex;justify-content:space-between;color:#666;">' + body + '</div>'
}

async function attachBookmarks(pdfBytes: Uint8Array, items: Array<{ title: string; page: number }>): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes)
  const pages = pdf.getPages()
  if (!pages.length) return pdfBytes
  const context = pdf.context
  const outlineRef = context.nextRef()
  const itemRefs: PDFRef[] = []
  const refs: Array<{ ref: PDFRef; title: string; page: number }> = []
  for (const it of items) {
    const r = context.nextRef()
    refs.push({ ref: r, title: it.title, page: Math.min(Math.max(it.page, 1), pages.length) })
    itemRefs.push(r)
  }
  for (let i = 0; i < refs.length; i++) {
    const cur = refs[i]
    const pageRef = pages[cur.page - 1].ref
    const dest = context.obj([pageRef, PDFName.of('XYZ'), null, null, null] as any)
    const item: Record<string, unknown> = {
      Type: PDFName.of('Outline'),
      Title: PDFHexString.fromText(cur.title),
      Parent: outlineRef,
      Dest: dest,
    }
    if (i > 0) item.Prev = refs[i - 1].ref
    if (i < refs.length - 1) item.Next = refs[i + 1].ref
    if (i === 0) item.First = refs[0].ref
    if (i === refs.length - 1) item.Last = refs[refs.length - 1].ref
    context.assign(cur.ref, context.obj(item as any))
  }
  const count = itemRefs.length
  const outline = context.obj({ Type: PDFName.of('Outlines'), First: refs[0].ref, Last: refs[refs.length - 1].ref, Count: count } as any)
  context.assign(outlineRef, outline)
  ;(pdf.catalog as any).set(PDFName.of('Outlines'), outlineRef)
  const saved = await pdf.save()
  return saved
}

export async function detectPandoc(): Promise<{ found: boolean; version?: string; path?: string }> {
  return new Promise((resolve) => {
    execFile('pandoc', ['--version'], { timeout: 5000 }, (err: any, stdout: string) => {
      if (err) { resolve({ found: false }); return }
      const m = /pandoc\s+([\d.]+)/.exec(stdout || '')
      resolve({ found: true, version: m ? m[1] : undefined })
    })
  })
}

export async function captureImage(htmlPath: string, outPath: string, width: number, height: number): Promise<{ path: string }> {
  const win = new BrowserWindow({ show: false, width: Math.max(200, Math.ceil(width)), height: Math.max(200, Math.ceil(height)), webPreferences: { offscreen: true } })
  try {
    await win.loadFile(htmlPath)
    await new Promise((r) => setTimeout(r, 300))
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: Math.max(200, Math.ceil(width)), height: Math.max(200, Math.ceil(height)) })
    ensureDir(join(outPath, '..'))
    writeFileSync(outPath, img.toPNG())
    return { path: outPath }
  } finally {
    win.destroy()
  }
}

export async function exportDocx(opts: ExportDocxOptions): Promise<{ path: string; warnings: string[] }> {
  const { buildDocx } = await import('./docx-export')
  return buildDocx(opts)
}

export function openPath(p: string): void { shell.openPath(p).catch(() => { /* ignore */ }) }
export function showItemInFolder(p: string): void { shell.showItemInFolder(p) }
export function openExternal(target: string): void { shell.openExternal(target).catch(() => { /* ignore */ }) }
export function trashPath(p: string): void { shell.trashItem(p).catch(() => { /* ignore */ }) }