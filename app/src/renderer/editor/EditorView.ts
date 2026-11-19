
import { EditorState, StateField, RangeSet, Compartment, StateEffect } from '@codemirror/state'
import { EditorView as CMEditorView, keymap, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo } from '@codemirror/commands'
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle, StreamLanguage, LanguageSupport } from '@codemirror/language'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches, search, openSearchPanel } from '@codemirror/search'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { DecorationSet } from '@codemirror/view'
import { buildDecorations, setWysiwyg, DecoContext } from './decorations'
import { Config } from '@shared/types'

export type EditMode = 'wysiwyg' | 'source'

export interface EditorHooks {
  onChange?: (text: string) => void
  onCursor?: (pos: number, line: number, col: number) => void
  onSave?: () => void
  onToggleSource?: () => void
  onEditBlock?: (block: any, raw: string) => void
  onToggleTask?: (block: any, from: number, to: number, checked: boolean) => void
  onJumpToLine?: (line: number) => void
  onQuickOpen?: () => void
}

const konaiHighlight = HighlightStyle.define([
  { tag: t.heading, class: 'cm-konai-src-heading' },
  { tag: t.strong, class: 'cm-konai-src-strong' },
  { tag: t.emphasis, class: 'cm-konai-src-em' },
  { tag: t.strikethrough, class: 'cm-konai-src-strike' },
  { tag: t.link, class: 'cm-konai-src-link' },
  { tag: t.monospace, class: 'cm-konai-src-code' },
  { tag: t.keyword, class: 'cm-konai-src-keyword' },
  { tag: t.comment, class: 'cm-konai-src-comment' },
])

function showDecoError(e: any): void {
  try {
    let el = document.getElementById('konai-deco-error')
    if (!el) {
      el = document.createElement('div')
      el.id = 'konai-deco-error'
      el.style.cssText = 'position:fixed;top:40px;left:8px;right:8px;z-index:9999;background:#fff3f3;color:#b31d28;border:1px solid #b31d28;padding:8px;font:12px monospace;white-space:pre-wrap;'
      document.body.appendChild(el)
    }
    el.textContent = 'decoration error: ' + ((e && e.stack) || String(e))
  } catch { /* ignore */ }
}

const allowWysiwyg = new Compartment()
const allowNumbers = new Compartment()
const allowSpell = new Compartment()

export class EditorViewWrapper {
  view: CMEditorView
  private ctx: DecoContext
  private hooks: EditorHooks
  private mode: EditMode = 'wysiwyg'
  private config: Config

  constructor(host: HTMLElement, config: Config, docDir: string, hooks: EditorHooks = {}) {
    this.config = config
    this.hooks = hooks
    this.ctx = {
      config, docDir, theme: config.theme,
      onEditBlock: (b, raw) => this.hooks.onEditBlock?.(b, raw),
      onToggleTask: (b, from, to, checked) => this.hooks.onToggleTask?.(b, from, to, checked),
      onJumpToLine: (ln) => this.hooks.onJumpToLine?.(ln),
    }
    const self = this
    const decoField = StateField.define<DecorationSet>({
      create: () => RangeSet.empty as DecorationSet,
      update(value, tr) {
        if (self.mode === 'source') return RangeSet.empty as DecorationSet
        if (!tr.docChanged && !tr.effects.some((e) => e.is(setWysiwyg))) return value
        try { return buildDecorations(tr.state, self.ctx) as DecorationSet } catch (e) { showDecoError(e); return value }
      },
      provide: (f) => CMEditorView.decorations.from(f),
    })

    const doc = ''
    const state = EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        search(),
        markdown({ base: markdownLanguage, addKeymap: true }),
        syntaxHighlighting(konaiHighlight),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...completionKeymap,
          indentWithTab,
          { key: 'Mod-b', run: () => this.wrapSelection('**', '**'), preventDefault: true },
          { key: 'Mod-i', run: () => this.wrapSelection('*', '*'), preventDefault: true },
          { key: 'Mod-e', run: () => this.wrapSelection('\x60', '\x60'), preventDefault: true },
          { key: 'Mod-k', run: () => this.insertLink(), preventDefault: true },
          { key: 'Mod-/', run: () => { this.hooks.onToggleSource?.(); return true }, preventDefault: true },
          { key: 'Alt-1', run: () => this.setHeading(1), preventDefault: true },
          { key: 'Alt-2', run: () => this.setHeading(2), preventDefault: true },
          { key: 'Alt-3', run: () => this.setHeading(3), preventDefault: true },
          { key: 'Alt-4', run: () => this.setHeading(4), preventDefault: true },
          { key: 'Alt-5', run: () => this.setHeading(5), preventDefault: true },
          { key: 'Alt-6', run: () => this.setHeading(6), preventDefault: true },
          { key: 'Alt-ArrowUp', run: () => this.moveBlock(-1), preventDefault: true },
          { key: 'Alt-ArrowDown', run: () => this.moveBlock(1), preventDefault: true },
          { key: 'Mod-Enter', run: () => { this.hooks.onSave?.(); return true }, preventDefault: true },
          { key: 'Mod-s', run: () => { this.hooks.onSave?.(); return true }, preventDefault: true },
          { key: 'Mod-p', run: () => { this.hooks.onQuickOpen?.(); return true }, preventDefault: true },
          { key: 'Tab', run: (v) => this.indentLine(v, true), preventDefault: true },
          { key: 'Shift-Tab', run: (v) => this.indentLine(v, false), preventDefault: true },
        ]),
        allowWysiwyg.of(decoField),
        allowNumbers.of([]),
        CMEditorView.updateListener.of((u) => {
          if (u.docChanged) this.hooks.onChange?.(u.state.doc.toString())
          if (u.selectionSet || u.docChanged) {
            const pos = u.state.selection.main.head
            const line = u.state.doc.lineAt(pos)
            this.hooks.onCursor?.(pos, line.number, pos - line.from + 1)
          }
        }),
        CMEditorView.theme({}),
      ],
    })
    this.view = new CMEditorView({ state, parent: host })
  }

  getText(): string { return this.view.state.doc.toString() }
  setText(text: string, resetHistory = true): void {
    const tr = this.view.state.update({ changes: { from: 0, to: this.view.state.doc.length, insert: text } })
    this.view.dispatch(tr)
  }
  replaceRange(from: number, to: number, text: string): void {
    this.view.dispatch({ changes: { from, to, insert: text } })
  }
  getSelection(): string { return this.view.state.sliceDoc(this.view.state.selection.main.from, this.view.state.selection.main.to) }

  setConfig(config: Config): void {
    this.config = config
    this.ctx.config = config
    this.ctx.theme = config.theme
    this.view.dispatch({ effects: [setWysiwyg.of(true)] })
  }
  setTheme(theme: string): void {
    this.ctx.theme = theme
    this.view.dispatch({ effects: [setWysiwyg.of(true)] })
  }
  setDocDir(dir: string): void {
    this.ctx.docDir = dir
    this.view.dispatch({ effects: [setWysiwyg.of(true)] })
  }

  setMode(mode: EditMode): void {
    this.mode = mode
    this.view.dispatch({ effects: [setWysiwyg.of(true)] })
    this.view.focus()
  }
  getMode(): EditMode { return this.mode }

  undo(): void { undo(this.view) }
  redo(): void { redo(this.view) }

  wrap(before: string, after: string): void { this.wrapSelection(before, after) }
  link(): void { this.insertLink() }
  heading(level: number): void { this.setHeading(level) }
  move(dir: number): void { this.moveBlock(dir) }
  indent(indent: boolean): void { this.indentLine(this.view, indent) }

  insertBlock(kind: string): void {
    const v = this.view
    const sel = v.state.selection.main
    const selected = v.state.sliceDoc(sel.from, sel.to)
    const line = v.state.doc.lineAt(sel.head)
    const insertAt = sel.empty ? line.from : sel.from
    let text = ''
    if (kind === 'ul') text = (line.text ? '\n' : '') + '- ' + selected
    else if (kind === 'ol') text = (line.text ? '\n' : '') + '1. ' + selected
    else if (kind === 'task') text = (line.text ? '\n' : '') + '- [ ] ' + selected
    else if (kind === 'quote') text = (line.text ? '\n' : '') + '> ' + selected
    else if (kind === 'code') text = (line.text ? '\n' : '') + '\x60\x60\x60\n' + selected + '\n\x60\x60\x60'
    else if (kind === 'table') text = (line.text ? '\n' : '') + '| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n|  |  |  |'
    else if (kind === 'hr') text = (line.text ? '\n' : '') + '---'
    else return
    v.dispatch({ changes: { from: insertAt, to: sel.empty ? insertAt : sel.to, insert: text }, selection: { anchor: insertAt + text.length } })
  }

  focus(): void { this.view.focus() }

  openFind(): void { openSearchPanel(this.view) }

  private wrapSelection(before: string, after: string): boolean {
    const v = this.view
    const sel = v.state.selection.main
    const selected = v.state.sliceDoc(sel.from, sel.to)
    const tr = v.state.update({
      changes: { from: sel.from, to: sel.to, insert: before + selected + after },
      selection: { anchor: sel.from + before.length, head: sel.from + before.length + selected.length },
      userEvent: 'edit.block',
    })
    v.dispatch(tr)
    return true
  }

  private insertLink(): boolean {
    const v = this.view
    const sel = v.state.selection.main
    const selected = v.state.sliceDoc(sel.from, sel.to) || 'link'
    const tr = v.state.update({
      changes: { from: sel.from, to: sel.to, insert: '[' + selected + '](https://)' },
      selection: { anchor: sel.from + selected.length + 3 },
    })
    v.dispatch(tr)
    return true
  }

  private setHeading(level: number): boolean {
    const v = this.view
    const line = v.state.doc.lineAt(v.state.selection.main.head)
    const text = line.text
    const m = /^(#{1,6})[ \t]*/.exec(text)
    const cur = m ? m[1].length : 0
    const hashes = '#'.repeat(level)
    if (cur === level) {
      v.dispatch({ changes: { from: line.from, to: line.to, insert: text.replace(/^#{1,6}[ \t]+/, '') } })
    } else if (cur > 0) {
      v.dispatch({ changes: { from: line.from, to: line.from + m![0].length, insert: hashes + ' ' } })
    } else {
      v.dispatch({ changes: { from: line.from, insert: hashes + ' ' } })
    }
    return true
  }

  private moveBlock(dir: number): boolean {
    const v = this.view
    const line = v.state.doc.lineAt(v.state.selection.main.head)
    const target = line.number + dir
    if (target < 1 || target > v.state.doc.lines) return true
    const other = v.state.doc.line(target)
    const thisText = line.text
    const otherText = other.text
    v.dispatch({
      changes: [
        { from: line.from, to: line.to, insert: otherText },
        { from: other.from, to: other.to, insert: thisText },
      ],
      selection: { anchor: other.from + (v.state.selection.main.head - line.from) },
    })
    return true
  }

  private indentLine(v: CMEditorView, indent: boolean): boolean {
    const line = v.state.doc.lineAt(v.state.selection.main.head)
    if (indent) v.dispatch({ changes: { from: line.from, insert: '  ' } })
    else {
      const m = /^ {1,2}\t?/.exec(line.text)
      if (m) v.dispatch({ changes: { from: line.from, to: line.from + m[0].length } })
    }
    return true
  }

  destroy(): void { this.view.destroy() }
}