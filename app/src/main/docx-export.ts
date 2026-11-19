
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import MarkdownIt from 'markdown-it'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, Footer, PageNumber,
} from 'docx'
import { ExportDocxOptions } from '@shared/types'

let md: any = null
function parser(): any {
  if (!md) md = new MarkdownIt({ html: false, linkify: true, breaks: false, typographer: false })
  return md
}

function renderInline(text: string): TextRun[] {
  const toks = parser().parseInline(text, {})
  const runs: TextRun[] = []
  const walk = (list: any[], bold = false, italics = false) => {
    for (const t of list) {
      if (t.type === 'text') runs.push(new TextRun({ text: t.content, bold, italics }))
      else if (t.type === 'code_inline') runs.push(new TextRun({ text: t.content, font: 'Consolas' }))
      else if (t.type === 'softbreak' || t.type === 'hardbreak') runs.push(new TextRun({ break: 1 }))
      else if (t.type === 'image') runs.push(new TextRun({ text: '[' + ((t.attrs || []).find((a: string[]) => a[0] === 'src')?.[1] || '') + ']', italics: true }))
      else if (t.children) walk(t.children, bold || t.type === 'strong_open', italics || t.type === 'em_open')
    }
  }
  walk(toks)
  return runs
}

const HEADINGS: Record<string, any> = {
  h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4, h5: HeadingLevel.HEADING_5, h6: HeadingLevel.HEADING_6,
}

export async function buildDocx(opts: ExportDocxOptions): Promise<{ path: string; warnings: string[] }> {
  const warnings: string[] = []
  const tokens = parser().parse(opts.text, {})
  const children: any[] = []
  let i = 0
  const listStack: number[] = []

  while (i < tokens.length) {
    const t = tokens[i]
    if (t.type === 'heading_open') {
      const inline = tokens[i + 1]
      children.push(new Paragraph({ heading: HEADINGS[t.tag] || HeadingLevel.HEADING_1, children: renderInline(inline ? inline.content : '') }))
      i += 3; continue
    }
    if (t.type === 'paragraph_open') {
      const inline = tokens[i + 1]
      const indent = listStack.length ? { left: Math.min(listStack.length, 6) * 360 } : undefined
      children.push(new Paragraph({ indent, children: renderInline(inline ? inline.content : '') }))
      i += 3; continue
    }
    if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') { listStack.push(1); i++; continue }
    if (t.type === 'bullet_list_close' || t.type === 'ordered_list_close') { listStack.pop(); i++; continue }
    if (t.type === 'list_item_open' || t.type === 'list_item_close') { i++; continue }
    if (t.type === 'blockquote_open' || t.type === 'blockquote_close') { i++; continue }
    if (t.type === 'code_block' || t.type === 'fence') {
      const lines = t.content.replace(/\n$/, '').split('\n')
      for (const line of lines) {
        children.push(new Paragraph({ shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' }, children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 18 })] }))
      }
      i++; continue
    }
    if (t.type === 'hr') { children.push(new Paragraph({ children: [] })); i++; continue }
    if (t.type === 'table_open') {
      const rows: any[] = []
      let j = i + 1
      while (j < tokens.length && tokens[j].type !== 'table_close') {
        if (tokens[j].type === 'tr_open') {
          const cells: any[] = []
          let k = j + 1
          while (k < tokens.length && tokens[k].type !== 'tr_close') {
            if (tokens[k].type === 'th_open' || tokens[k].type === 'td_open') {
              const inline = tokens[k + 1]
              const isHead = tokens[k].type === 'th_open'
              cells.push(new TableCell({
                children: [new Paragraph({ children: renderInline(inline ? inline.content : '') })],
                shading: isHead ? { type: ShadingType.CLEAR, fill: 'EEEEEE' } : undefined,
                width: { size: Math.floor(9000 / Math.max(1, cells.length + 1)), type: WidthType.DXA },
              }))
              k += 3; continue
            }
            k++
          }
          rows.push(new TableRow({ children: cells }))
          j = k + 1; continue
        }
        j++
      }
      if (rows.length) {
        children.push(new Table({
          rows, width: { size: 9000, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
            left: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' }, insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
          },
        }))
      }
      i = j + 1; continue
    }
    if (t.type === 'image') {
      children.push(new Paragraph({ children: [new TextRun({ text: '[image: ' + ((t.attrs || []).find((a: string[]) => a[0] === 'alt')?.[1] || '') + ']', italics: true })] }))
      i++; continue
    }
    i++
  }

  const doc = new Document({
    creator: 'Konai',
    title: opts.title || 'Untitled',
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{
      properties: {},
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT] })] })] }) },
      children,
    }],
  })
  mkdirSync(join(opts.path, '..'), { recursive: true })
  const buf = await Packer.toBuffer(doc)
  writeFileSync(opts.path, buf)
  return { path: opts.path, warnings }
}
