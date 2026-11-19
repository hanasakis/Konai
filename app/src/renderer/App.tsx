
import React, { useEffect, useRef, useState } from 'react'
import { useStore, docFromSnapshot, untitledDoc, DocState } from './store'
import { MenuBar } from './components/MenuBar'
import { Sidebar } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'
import { EditorPane, editorRef, applyBlockEdit, applyTaskToggle } from './editor/EditorPane'
import { PreferencesDialog, ExportDialog, QuickOpenDialog, GlobalSearchDialog, AboutDialog } from './components/Dialogs'
import { applyTheme, isDarkTheme } from './theme/theme'
import { extractOutline, wordCount } from './editor/kernel'
import { buildExportHtml } from './export'
import { Config } from '@shared/types'

const K = (): any => (window as any).konai

export function App() {
  const config = useStore((s) => s.config)
  const folder = useStore((s) => s.folder)
  const files = useStore((s) => s.files)
  const tabs = useStore((s) => s.tabs)
  const activeTab = useStore((s) => s.activeTab)
  const mode = useStore((s) => s.mode)
  const dialog = useStore((s) => s.dialog)
  const readonly = useStore((s) => s.readonly)
  const focusMode = useStore((s) => s.focusMode)
  const typewriterMode = useStore((s) => s.typewriterMode)
  const outline = useStore((s) => s.outline)

  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [toast, setToast] = useState('')
  const [systemDark, setSystemDark] = useState(false)
  const [zoom, setZoom] = useState(1)
  const closedRef = useRef<DocState[]>([])
  const toastTimer = useRef<any>(null)

  const doc: DocState | null = activeTab >= 0 && activeTab < tabs.length ? tabs[activeTab] : null
  const dark = config.followSystemTheme ? systemDark : isDarkTheme(config.theme)

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }

  useEffect(() => {
    const api = K()
    if (!api) return
    Promise.resolve(api.config.load()).then((c: Config) => {
      useStore.getState().setConfigLocal(c)
      applyTheme(c.theme, c.followSystemTheme ? false : isDarkTheme(c.theme))
    }).catch(() => { /* ignore */ })
    Promise.resolve(api.app.theme()).then((t: any) => {
      setSystemDark(!!t && t.shouldUseDarkColors)
      const cfg = useStore.getState().config
      applyTheme(cfg.theme, cfg.followSystemTheme ? !!t && t.shouldUseDarkColors : isDarkTheme(cfg.theme))
    }).catch(() => { /* ignore */ })
    api.onConfig((c: Config) => { useStore.getState().setConfigLocal(c); applyTheme(c.theme, c.followSystemTheme ? systemDark : isDarkTheme(c.theme)) })
    api.onThemeChanged(() => {
      Promise.resolve(api.app.theme()).then((t: any) => {
        setSystemDark(!!t && t.shouldUseDarkColors)
        const cfg = useStore.getState().config
        applyTheme(cfg.theme, cfg.followSystemTheme ? !!t && t.shouldUseDarkColors : isDarkTheme(cfg.theme))
      })
    })
    api.onOpenFile((p: string) => { openFile(p) })
    api.onFsEvent((ev: any) => {
      if (ev && ev.path) {
        const st = useStore.getState()
        if (st.folder && ev.path.startsWith(st.folder)) refreshFiles()
        const d = st.tabs[st.activeTab]
        if (d && d.path && ev.path === d.path && (ev.type === 'change' || ev.type === 'unlink')) {
          if (!d.dirty) reloadDoc(d.path)
          else showToast('文件已被外部修改（当前有未保存更改）')
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { applyTheme(config.theme, dark) }, [config.theme, dark, config.followSystemTheme])
  useEffect(() => { K()?.app.setZoom(zoom) }, [zoom])

  useEffect(() => {
    const name = doc ? doc.name : '未命名'
    const mark = doc && doc.dirty ? '•' : ''
    K()?.app.setTitle(name + mark + ' - Konai')
  }, [doc?.name, doc?.dirty])

  useEffect(() => {
    if (!doc) { useStore.getState().setOutline([]); return }
    useStore.getState().setOutline(extractOutline(doc.text))
  }, [doc?.text])

  useEffect(() => {
    const mins = config.autoSaveTimer
    if (!mins || mins <= 0) return
    const t = setInterval(() => {
      const st = useStore.getState()
      const d = st.tabs[st.activeTab]
      if (d && d.dirty && d.path) saveDoc(d, false)
    }, mins * 60 * 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.autoSaveTimer, activeTab])

  async function refreshFiles() {
    const st = useStore.getState()
    if (!st.folder) { st.setFiles([]); return }
    try { st.setFiles(await K().fs.listDir(st.folder)) } catch { st.setFiles([]) }
  }

  async function openFolder(path: string) {
    const st = useStore.getState()
    st.setFolder(path)
    try {
      st.setFiles(await K().fs.listDir(path))
      K().fs.watch(path)
      K().fs.openFolder(path)
    } catch { st.setFiles([]) }
  }

  async function openFile(path: string) {
    const st = useStore.getState()
    try {
      const snap = await K().fs.openFile(path)
      const d = docFromSnapshot(snap)
      const existing = st.tabs.findIndex((t) => t.path === path)
      if (existing >= 0) { st.setActiveTab(existing); st.updateTab(existing, { text: snap.text, savedText: snap.text, dirty: false }) }
      else { st.setTabs([...st.tabs, d]); st.setActiveTab(st.tabs.length) }
      if (st.folder) refreshFiles()
    } catch (e) { showToast('无法打开文件：' + String(e)) }
  }

  async function reloadDoc(path: string) {
    try {
      const snap = await K().fs.openFile(path)
      const st = useStore.getState()
      const idx = st.tabs.findIndex((t) => t.path === path)
      if (idx >= 0) st.updateTab(idx, { text: snap.text, savedText: snap.text, dirty: false, mtime: snap.mtime })
    } catch { /* ignore */ }
  }

  async function saveDoc(d: DocState, clearDraft = true): Promise<boolean> {
    if (!d.path) return saveAs(d)
    try {
      const r = await K().fs.saveFile(d.path, d.text)
      const st = useStore.getState()
      const idx = st.tabs.findIndex((t) => t.path === d.path)
      if (idx >= 0) st.updateTab(idx, { dirty: false, savedText: d.text, mtime: r.mtime })
      if (clearDraft) K().fs.clearDraft(d.path)
      return true
    } catch (e) { showToast('保存失败：' + String(e)); return false }
  }

  async function saveAs(d: DocState): Promise<boolean> {
    const p = await K().app.showSaveDialog({ defaultPath: d.name, filters: [{ name: 'Markdown', extensions: ['md'] }] })
    if (!p) return false
    try {
      const r = await K().fs.saveFile(p, d.text)
      const st = useStore.getState()
      const idx = st.tabs.findIndex((t) => t.name === d.name)
      if (idx >= 0) st.updateTab(idx, { path: p, name: p.split(/[\\/]/).pop() || p, dirty: false, savedText: d.text, mtime: r.mtime })
      K().fs.clearDraft(p)
      if (st.folder) refreshFiles()
      return true
    } catch (e) { showToast('保存失败：' + String(e)); return false }
  }

  function closeTab(i: number) {
    const st = useStore.getState()
    const d = st.tabs[i]
    if (d && d.dirty && d.text) { try { K().fs.saveDraft(d.path || d.name, d.text) } catch { /* ignore */ } }
    closedRef.current.unshift(d)
    st.closeTab(i)
  }

  async function runCommand(id: string) {
    const st = useStore.getState()
    const d = st.tabs[st.activeTab]
    const ed = editorRef.current
    switch (id) {
      case 'file.new': case 'file.newTab': {
        const nd = untitledDoc()
        st.setTabs([...st.tabs, nd]); st.setActiveTab(st.tabs.length)
        break
      }
      case 'file.newWindow': K().app.newWindow(); break
      case 'file.open': {
        const paths = await K().app.pickFile([{ name: 'Markdown', extensions: ['md', 'markdown', 'txt', 'mdx', 'mdown', 'mdtxt'] }])
        if (paths && paths.length) for (const p of paths) openFile(p)
        break
      }
      case 'file.openFolder': {
        const p = await K().app.pickFolder()
        if (p) openFolder(p)
        break
      }
      case 'file.save': if (d) await saveDoc(d); break
      case 'file.saveAs': if (d) await saveAs(d); break
      case 'export.html': case 'export.htmlPlain': case 'export.pdf': case 'export.docx': case 'export.image': case 'file.print':
        st.setDialog('export'); break
      case 'file.closeTab': if (st.activeTab >= 0) closeTab(st.activeTab); break
      case 'file.reopenClosed': {
        const last = closedRef.current.shift()
        if (last) { st.setTabs([...st.tabs, last]); st.setActiveTab(st.tabs.length) }
        break
      }
      case 'app.quit': K().app.windowAction('close'); break

      case 'edit.undo': ed?.undo(); break
      case 'edit.redo': ed?.redo(); break
      case 'edit.cut': document.execCommand('cut'); break
      case 'edit.copy': document.execCommand('copy'); break
      case 'edit.paste': document.execCommand('paste'); break
      case 'edit.selectAll': ed?.focus(); document.execCommand('selectAll'); break
      case 'edit.find': ed?.openFind(); break
      case 'edit.replace': ed?.openFind(); break
      case 'edit.copyMarkdown': if (d) { try { await navigator.clipboard.writeText(d.text) } catch { /* ignore */ } } break
      case 'edit.copyHtml': if (d) {
        const res = await buildExportHtml(d.text, { docDir: dirOf(d.path), theme: st.config.theme, dark, mathMode: 'svg', styled: false, title: d.name })
        try { await navigator.clipboard.writeText(res.html) } catch { /* ignore */ }
        break
      }
      case 'edit.copyPlainText': if (d) { try { await navigator.clipboard.writeText(d.text) } catch { /* ignore */ } } break
      case 'edit.copyNoStyle': if (d) {
        const res = await buildExportHtml(d.text, { docDir: dirOf(d.path), theme: st.config.theme, dark, mathMode: 'svg', styled: false, title: d.name })
        try { await navigator.clipboard.writeText(res.body || res.html) } catch { /* ignore */ }
        break
      }
      case 'edit.readonly': st.setReadonly(!st.readonly); st.saveConfig({ readonlyMode: !st.readonly }); break

      case 'paragraph.h1': ed?.heading(1); break
      case 'paragraph.h2': ed?.heading(2); break
      case 'paragraph.h3': ed?.heading(3); break
      case 'paragraph.h4': ed?.heading(4); break
      case 'paragraph.h5': ed?.heading(5); break
      case 'paragraph.h6': ed?.heading(6); break
      case 'paragraph.increaseHeading': ed?.heading(Math.min(6, currentLevel(ed) + 1)); break
      case 'paragraph.decreaseHeading': ed?.heading(Math.max(1, currentLevel(ed) - 1)); break
      case 'paragraph.ul': ed?.insertBlock('ul'); break
      case 'paragraph.ol': ed?.insertBlock('ol'); break
      case 'paragraph.task': ed?.insertBlock('task'); break
      case 'paragraph.quote': ed?.insertBlock('quote'); break
      case 'paragraph.code': ed?.insertBlock('code'); break
      case 'paragraph.table': ed?.insertBlock('table'); break
      case 'paragraph.indent': ed?.indent(true); break
      case 'paragraph.outdent': ed?.indent(false); break
      case 'paragraph.toggleTask': ed?.insertBlock('task'); break

      case 'format.bold': ed?.wrap('**', '**'); break
      case 'format.italic': ed?.wrap('*', '*'); break
      case 'format.strike': ed?.wrap('~~', '~~'); break
      case 'format.code': ed?.wrap('\x60', '\x60'); break
      case 'format.link': ed?.link(); break
      case 'format.underline': ed?.wrap('<u>', '</u>'); break
      case 'format.highlight': ed?.wrap('==', '=='); break
      case 'format.emoji': break

      case 'view.source': st.setMode(st.mode === 'wysiwyg' ? 'source' : 'wysiwyg'); break
      case 'view.focus': st.setFocusMode(!st.focusMode); st.saveConfig({ focusMode: !st.focusMode }); break
      case 'view.typewriter': st.setTypewriterMode(!st.typewriterMode); st.saveConfig({ typewriterMode: !st.typewriterMode }); break
      case 'view.sidebar': st.saveConfig({ sidebarVisible: !st.config.sidebarVisible }); break
      case 'view.statusbar': st.saveConfig({ showStatusBar: !st.config.showStatusBar }); break
      case 'view.zoomIn': setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2))); break
      case 'view.zoomOut': setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2))); break
      case 'view.zoomReset': setZoom(1); break
      case 'view.fullscreen': K().app.windowAction('fullscreen'); break
      case 'view.alwaysOnTop': K().app.windowAction('alwaysOnTop'); break

      case 'theme.github': case 'theme.newsprint': case 'theme.night': case 'theme.pixyll': case 'theme.whitey':
        st.saveConfig({ theme: id.split('.')[1] }); break
      case 'theme.openFolder': K().shell.openThemeFolder(); break
      case 'theme.customCss': showToast('在主题文件夹中创建 base.user.css 或 <主题>.user.css'); break

      case 'help.about': st.setDialog('about'); break
      case 'help.checkUpdates': {
        const r = await K().app.checkUpdates()
        showToast(r && r.ok ? ('最新版本：' + (r.version || '未知')) : '检查更新失败（网络不可用）')
        break
      }
      case 'help.quickStart': {
        const nd = untitledDoc(); nd.text = QUICK_START; nd.savedText = ''; nd.dirty = true
        st.setTabs([...st.tabs, nd]); st.setActiveTab(st.tabs.length)
        break
      }
      case 'help.markdownReference': {
        const nd = untitledDoc(); nd.text = MD_REFERENCE; nd.savedText = ''; nd.dirty = true
        st.setTabs([...st.tabs, nd]); st.setActiveTab(st.tabs.length)
        break
      }
      default: break
    }
  }

  function currentLevel(ed: any): number {
    if (!ed) return 1
    try {
      const line = ed.view.state.doc.lineAt(ed.view.state.selection.main.head)
      const m = /^(#{1,6})/.exec(line.text)
      return m ? m[1].length : 1
    } catch { return 1 }
  }

  const wc = doc ? wordCount(doc.text) : { words: 0, chars: 0, lines: 0 }

  return (
    <div className="konai-app">
      <MenuBar onCommand={(id) => runCommand(id)} />
      <div className="konai-main">
        <Sidebar
          folder={folder}
          files={files}
          activePath={doc ? doc.path : ''}
          config={config}
          outline={outline}
          tab={config.sidebarTab}
          onTab={(t) => useStore.getState().saveConfig({ sidebarTab: t })}
          onOpenFile={(p) => openFile(p)}
          onNavigate={(p) => { if (p) openFolder(p) }}
          onRefresh={() => refreshFiles()}
          onNewFile={async (dir, name) => { await K().fs.newFile(dir, name); refreshFiles() }}
          onNewFolder={async (dir, name) => { await K().fs.newFolder(dir, name); refreshFiles() }}
          onRename={async (oldP, newP) => { await K().fs.rename(oldP, newP); refreshFiles() }}
          onDelete={async (paths) => { await K().fs.trash(paths); showToast('已删除（可撤销）'); refreshFiles() }}
          onJumpLine={(ln) => { const ed = editorRef.current; if (ed) { const line = ed.view.state.doc.line(Math.min(ln + 1, ed.view.state.doc.lines)); ed.view.dispatch({ selection: { anchor: line.from } }); ed.focus() } }}
        />
        <div className={'konai-editor-wrap' + (focusMode ? ' focus-mode' : '') + (typewriterMode ? ' typewriter-mode' : '')}>
          <div className="konai-tabs">
            {tabs.map((t, i) => (
              <div key={t.path || t.name + i} className={'konai-tab' + (i === activeTab ? ' active' : '')} onClick={() => useStore.getState().setActiveTab(i)}>
                {t.dirty ? <span className="dot" /> : null}
                <span className="name">{t.name}</span>
                <button className="close" onClick={(e) => { e.stopPropagation(); closeTab(i) }}>×</button>
              </div>
            ))}
            {!tabs.length ? <div className="konai-tabs-empty">未打开文档</div> : null}
          </div>
          {doc ? (
            <EditorPane
              config={config}
              docDir={dirOf(doc.path)}
              text={doc.text}
              mode={mode}
              onTextChange={(t) => useStore.getState().updateTab(activeTab, { text: t, dirty: t !== (doc.savedText || '') })}
              onCursor={(_p, line, col) => setCursor({ line, col })}
              onSave={() => saveDoc(doc)}
              onToggleSource={() => useStore.getState().setMode(mode === 'wysiwyg' ? 'source' : 'wysiwyg')}
              onQuickOpen={() => useStore.getState().setDialog('quickopen')}
              onEditBlock={(b, raw) => applyBlockEdit(editorRef.current, b, raw)}
              onToggleTask={(b, f, t, c) => applyTaskToggle(editorRef.current, f, t, c)}
              onJumpToLine={(ln) => { const ed = editorRef.current; if (ed) { const line = ed.view.state.doc.line(Math.min(ln + 1, ed.view.state.doc.lines)); ed.view.dispatch({ selection: { anchor: line.from } }); ed.focus() } }}
            />
          ) : (
            <div className="konai-empty" style={{ paddingTop: 80 }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Konai</div>
              <div>新建文档、打开文件夹，或把 .md 文件拖入窗口开始。</div>
            </div>
          )}
        </div>
      </div>
      <StatusBar
        mode={mode}
        onToggleSource={() => useStore.getState().setMode(mode === 'wysiwyg' ? 'source' : 'wysiwyg')}
        words={wc.words} chars={wc.chars} lines={wc.lines}
        cursorLine={cursor.line} cursorCol={cursor.col}
        readonly={readonly} focusMode={focusMode} typewriterMode={typewriterMode}
        showStatus={config.showStatusBar}
        zoom={zoom} onZoom={setZoom}
        onToggleReadonly={() => useStore.getState().setReadonly(!readonly)}
        onToggleFocus={() => useStore.getState().setFocusMode(!focusMode)}
        onToggleTypewriter={() => useStore.getState().setTypewriterMode(!typewriterMode)}
      />

      {dialog === 'preferences' ? <PreferencesDialog config={config} onClose={() => useStore.getState().setDialog(null)} onChange={(p) => useStore.getState().saveConfig(p)} /> : null}
      {dialog === 'export' && doc ? <ExportDialog text={doc.text} title={doc.name} theme={config.theme} dark={dark} docDir={dirOf(doc.path)} onClose={() => useStore.getState().setDialog(null)} onToast={showToast} /> : null}
      {dialog === 'quickopen' ? <QuickOpenDialog root={folder || ''} onClose={() => useStore.getState().setDialog(null)} onOpen={(p) => openFile(p)} /> : null}
      {dialog === 'search' ? <GlobalSearchDialog root={folder || ''} onClose={() => useStore.getState().setDialog(null)} onOpen={(p, line) => { openFile(p) }} /> : null}
      {dialog === 'about' ? <AboutDialog onClose={() => useStore.getState().setDialog(null)} /> : null}
      {toast ? <div className="konai-toast">{toast}</div> : null}
    </div>
  )
}

function dirOf(path: string): string {
  if (!path) return ''
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return i >= 0 ? path.slice(0, i) : ''
}

const QUICK_START = [
  '# 欢迎使用 Konai',
  '',
  'Konai 是一个**完全免费**、无激活、无遥测的 Markdown 编辑器。',
  '',
  '## 基本操作',
  '',
  '- 直接输入 Markdown，结果会实时渲染',
  '- 选中本文本，按 Ctrl+B 加粗、Ctrl+I 斜体',
  '- 使用左侧文件树打开文件夹',
  '- Ctrl+S 保存，Ctrl+P 快速打开',
  '- 文件 → 导出 → PDF / HTML / Word',
  '',
  '## 试试这些语法',
  '',
  '| 功能 | 状态 |',
  '| --- | --- |',
  '| 表格 | 可用 |',
  '| 代码高亮 | 可用 |',
  '',
  '- [x] 任务列表已完成',
  '- [ ] 点击左侧复选框切换',
  '',
  '\x60\x60\x60js',
  'function hello() { return "Konai"; }',
  '\x60\x60\x60',
  '',
  '行内数学 $E=mc^2$，块级数学：',
  '',
  '$$\\int_0^1 x^2 dx$$',
  '',
  '\x60\x60\x60mermaid',
  'graph LR; A[开始] --> B{判断}; B -->|是| C[结果一]; B -->|否| D[结果二]',
  '\x60\x60\x60',
  '',
  '> [!NOTE]',
  '> 这是一个提示块。',
  '',
  '脚注示例[^1]。',
  '',
  '[^1]: 这是脚注内容。',
].join('\n')

const MD_REFERENCE = [
  '# Markdown 参考',
  '',
  '## 标题',
  '',
  '\x60\x60\x60',
  '# 一级标题',
  '## 二级标题',
  '### 三级标题',
  '\x60\x60\x60',
  '',
  '## 强调',
  '',
  '**粗体** *斜体* ***粗斜体*** ~~删除线~~ \x60行内代码\x60',
  '',
  '## 列表',
  '',
  '1. 有序项',
  '2. 有序项',
  '   - 嵌套无序项',
  '',
  '- [ ] 未完成任务',
  '- [x] 已完成任务',
  '',
  '## 链接与图片',
  '',
  '[链接文字](https://example.com)',
  '',
  '![替代文字](image.png)',
  '',
  '## 代码块',
  '',
  '\x60\x60\x60python',
  'def f(x):',
  '    return x * 2',
  '\x60\x60\x60',
  '',
  '## 引用',
  '',
  '> 引用内容',
  '>> 嵌套引用',
  '',
  '## 表格',
  '',
  '| 左对齐 | 居中 | 右对齐 |',
  '| :--- | :---: | ---: |',
  '| a | b | c |',
  '',
  '## 数学',
  '',
  '行内 $a^2+b^2=c^2$，块级：',
  '',
  '$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$',
  '',
  '## 其他',
  '',
  '- 分隔线：\x60---\x60',
  '- 脚注：\x60[^1]\x60 与 \x60[^1]: 定义\x60',
  '- 目录：\x60[toc]\x60',
  '- Emoji：\x60:smile:\x60',
  '- 高亮（需在偏好中开启）：\x60==高亮==\x60',
  '',
].join('\n')
