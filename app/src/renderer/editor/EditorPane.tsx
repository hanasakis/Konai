
import React, { useEffect, useRef } from 'react'
import { EditorViewWrapper, EditorHooks } from './EditorView'
import { Config } from '@shared/types'

export const editorRef: { current: EditorViewWrapper | null } = { current: null }

interface Props {
  config: Config
  docDir: string
  text: string
  mode: 'wysiwyg' | 'source'
  onTextChange: (text: string) => void
  onCursor: (pos: number, line: number, col: number) => void
  onSave: () => void
  onToggleSource: () => void
  onQuickOpen: () => void
  onEditBlock: (block: any, raw: string) => void
  onToggleTask: (block: any, from: number, to: number, checked: boolean) => void
  onJumpToLine: (line: number) => void
}

export function EditorPane(props: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const edRef = useRef<EditorViewWrapper | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    if (!hostRef.current) return
    const hooks: EditorHooks = {
      onChange: (t) => propsRef.current.onTextChange(t),
      onCursor: (p, l, c) => propsRef.current.onCursor(p, l, c),
      onSave: () => propsRef.current.onSave(),
      onToggleSource: () => propsRef.current.onToggleSource(),
      onQuickOpen: () => propsRef.current.onQuickOpen(),
      onEditBlock: (b, raw) => propsRef.current.onEditBlock(b, raw),
      onToggleTask: (b, f, t, c) => propsRef.current.onToggleTask(b, f, t, c),
      onJumpToLine: (l) => propsRef.current.onJumpToLine(l),
    }
    const ed = new EditorViewWrapper(hostRef.current, propsRef.current.config, propsRef.current.docDir, hooks)
    ed.setText(propsRef.current.text)
    edRef.current = ed
    editorRef.current = ed
    return () => { ed.destroy(); edRef.current = null; editorRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { edRef.current?.setText(props.text) }, [props.text])
  useEffect(() => { edRef.current?.setConfig(props.config) }, [props.config])
  useEffect(() => { edRef.current?.setDocDir(props.docDir) }, [props.docDir])
  useEffect(() => { edRef.current?.setMode(props.mode) }, [props.mode])

  return <div className="konai-editor-host" data-mode={props.mode} ref={hostRef} />
}

export function applyBlockEdit(ed: EditorViewWrapper | null, block: any, nextRaw: string): void {
  if (!ed) return
  const text = ed.getText()
  let from = block.from
  let to = block.to
  if (text.slice(from, to) !== block.raw) {
    const idx = text.indexOf(block.raw)
    if (idx >= 0) { from = idx; to = idx + block.raw.length }
  }
  ed.replaceRange(from, to, nextRaw)
}

export function applyTaskToggle(ed: EditorViewWrapper | null, from: number, to: number, checked: boolean): void {
  if (!ed) return
  ed.replaceRange(from, to, checked ? '[x] ' : '[ ] ')
}
