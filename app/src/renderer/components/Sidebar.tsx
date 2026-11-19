
import React, { useEffect, useState } from 'react'
import { FileEntry } from '@shared/types'

interface Props {
  folder: string | null
  files: FileEntry[]
  activePath: string
  config: any
  outline: Array<{ level: number; text: string; line: number; from: number; id: string }>
  tab: 'file' | 'outline'
  onTab: (t: 'file' | 'outline') => void
  onOpenFile: (path: string) => void
  onNavigate: (path: string) => void
  onRefresh: () => void
  onNewFile: (dir: string, name: string) => void
  onNewFolder: (dir: string, name: string) => void
  onRename: (oldPath: string, newPath: string) => void
  onDelete: (paths: string[]) => void
  onJumpLine: (line: number) => void
}

function fmtTime(ms: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  const now = new Date()
  const diff = now.getTime() - ms
  if (diff < 60 * 60 * 1000) return Math.max(1, Math.round(diff / 60000)) + ' 分钟前'
  if (diff < 24 * 60 * 60 * 1000) return Math.round(diff / 3600000) + ' 小时前'
  return d.toLocaleDateString()
}

export function Sidebar(props: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [children, setChildren] = useState<Record<string, FileEntry[]>>({})
  const [creating, setCreating] = useState<null | 'file' | 'folder'>(null)
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const toggle = async (e: FileEntry) => {
    if (!e.isDir) { props.onOpenFile(e.path); return }
    const next = { ...expanded, [e.path]: !expanded[e.path] }
    setExpanded(next)
    if (next[e.path] && !children[e.path]) {
      const list = await window.konai.fs.listDir(e.path)
      setChildren((c) => ({ ...c, [e.path]: list }))
    }
  }

  const submitCreate = async () => {
    if (!name.trim() || !props.folder) return
    if (creating === 'file') await props.onNewFile(props.folder, name.trim())
    else if (creating === 'folder') await props.onNewFolder(props.folder, name.trim())
    setCreating(null); setName('')
  }

  const submitRename = async () => {
    if (!renaming || !renameVal.trim()) return
    const dir = renaming.replace(/[\\/][^\\/]*$/, '')
    await props.onRename(renaming, dir + '\\' + renameVal.trim())
    setRenaming(null); setRenameVal('')
  }

  const renderEntries = (entries: FileEntry[], depth: number): React.ReactNode => {
    return entries.map((e) => {
      const isOpen = !!expanded[e.path]
      const kids = children[e.path]
      return (
        <div key={e.path}>
          <div
            className={'konai-file-row' + (e.isDir ? ' dir' : '') + (props.activePath === e.path ? ' active' : '')}
            style={{ paddingLeft: 10 + depth * 12 }}
            onClick={() => toggle(e)}
            onContextMenu={(ev) => { ev.preventDefault(); setMenuFor(e.path) }}
            title={e.path}
          >
            <span>{e.isDir ? (isOpen ? '▾' : '▸') : '‹›'}</span>
            {renaming === e.path ? (
              <input className="konai-input" autoFocus value={renameVal} onChange={(ev) => setRenameVal(ev.target.value)}
                onClick={(ev) => ev.stopPropagation()}
                onBlur={submitRename}
                onKeyDown={(ev) => { if (ev.key === 'Enter') submitRename(); if (ev.key === 'Escape') setRenaming(null) }} />
            ) : (
              <span className="name">{e.name}</span>
            )}
            <span className="meta">{e.isDir ? '' : fmtTime(e.mtime)}</span>
          </div>
          {menuFor === e.path ? (
            <div className="konai-menu-dropdown" style={{ position: 'fixed', left: 120, top: 120, zIndex: 900 }}>
              {!e.isDir ? <div className="konai-menu-row" onClick={() => { props.onOpenFile(e.path); setMenuFor(null) }}><span className="konai-menu-label">打开</span></div> : null}
              <div className="konai-menu-row" onClick={() => { setCreating('file'); setMenuFor(null) }}><span className="konai-menu-label">新建文件</span></div>
              <div className="konai-menu-row" onClick={() => { setCreating('folder'); setMenuFor(null) }}><span className="konai-menu-label">新建文件夹</span></div>
              <div className="konai-menu-row" onClick={() => { setRenaming(e.path); setRenameVal(e.name); setMenuFor(null) }}><span className="konai-menu-label">重命名</span></div>
              <div className="konai-menu-row" onClick={() => { props.onDelete([e.path]); setMenuFor(null) }}><span className="konai-menu-label">删除</span></div>
            </div>
          ) : null}
          {e.isDir && isOpen ? renderEntries(kids || [], depth + 1) : null}
        </div>
      )
    })
  }

  return (
    <div className={'konai-sidebar' + (props.config.sidebarVisible ? '' : ' hidden')} style={{ ['--konai-sidebar-width' as any]: (props.config.sidebarWidth || 260) + 'px' }}>
      <div className="konai-sidebar-tabs">
        <div className={'konai-sidebar-tab' + (props.tab === 'file' ? ' active' : '')} onClick={() => props.onTab('file')}>文件</div>
        <div className={'konai-sidebar-tab' + (props.tab === 'outline' ? ' active' : '')} onClick={() => props.onTab('outline')}>大纲</div>
      </div>
      {props.tab === 'file' ? (
        <>
          <div className="konai-sidebar-tools">
            <button className="konai-icon-btn" title="上级目录" onClick={() => { if (props.folder) props.onNavigate(props.folder.replace(/[\\/][^\\/]*$/, '')) }}>↑</button>
            <button className="konai-icon-btn" title="新建文件" onClick={() => setCreating('file')}>＋文件</button>
            <button className="konai-icon-btn" title="新建文件夹" onClick={() => setCreating('folder')}>＋夹</button>
            <span className="spacer" />
            <button className="konai-icon-btn" title="刷新" onClick={props.onRefresh}>⟳</button>
          </div>
          {creating ? (
            <div style={{ padding: 6 }}>
              <input className="konai-input" autoFocus placeholder={creating === 'file' ? '文件名.md' : '文件夹名'} value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape') setCreating(null) }} />
            </div>
          ) : null}
          <div className="konai-file-list">
            {props.folder ? renderEntries(props.files, 0) : <div className="konai-empty">尚未打开文件夹<br />使用 文件 → 打开文件夹</div>}
          </div>
        </>
      ) : (
        <div className="konai-outline-list">
          {props.outline.length ? props.outline.map((o) => (
            <div key={o.id + o.line} className={'konai-outline-item konai-outline-h' + o.level} onClick={() => props.onJumpLine(o.line)} title={o.text}>
              {o.text}
            </div>
          )) : <div className="konai-empty">无标题</div>}
        </div>
      )}
    </div>
  )
}
