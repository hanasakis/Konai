
import React from 'react'

interface Props {
  mode: 'wysiwyg' | 'source'
  onToggleSource: () => void
  words: number
  chars: number
  lines: number
  cursorLine: number
  cursorCol: number
  readonly: boolean
  focusMode: boolean
  typewriterMode: boolean
  showStatus: boolean
  zoom: number
  onZoom: (z: number) => void
  onToggleReadonly: () => void
  onToggleFocus: () => void
  onToggleTypewriter: () => void
}

export function StatusBar(p: Props) {
  if (!p.showStatus) return null
  return (
    <div className="konai-statusbar">
      <button className={p.mode === 'wysiwyg' ? 'active' : ''} onClick={p.onToggleSource} title="所见即所得模式">‹</button>
      <button className={p.mode === 'source' ? 'active' : ''} onClick={p.onToggleSource} title="源码模式">‹›</button>
      <span className="mode-badge">
        {p.readonly ? '只读' : ''}{p.focusMode ? ' 专注' : ''}{p.typewriterMode ? ' 打字机' : ''}
      </span>
      <span className="spacer" />
      <span>第 {p.cursorLine} 行，第 {p.cursorCol} 列</span>
      <span>{p.lines} 行 / {p.words} 词 / {p.chars} 字符</span>
      <button onClick={() => p.onZoom(p.zoom - 0.1)} title="缩小">−</button>
      <span>{Math.round(p.zoom * 100)}%</span>
      <button onClick={() => p.onZoom(p.zoom + 0.1)} title="放大">＋</button>
    </div>
  )
}
