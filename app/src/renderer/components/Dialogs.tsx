
import React, { useEffect, useState } from 'react'
import { Config } from '@shared/types'
import { THEMES } from '../theme/theme'
import { buildExportHtml, exportCss } from '../export'
import { escapeHtml } from '../render'

function Shell(props: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; foot?: React.ReactNode }) {
  return (
    <div className="konai-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) props.onClose() }}>
      <div className={'konai-dialog' + (props.wide ? ' wide' : '')}>
        <div className="konai-dialog-head"><span>{props.title}</span><button className="konai-btn" onClick={props.onClose}>×</button></div>
        <div className="konai-dialog-body">{props.children}</div>
        {props.foot ? <div className="konai-dialog-foot">{props.foot}</div> : null}
      </div>
    </div>
  )
}

export function PreferencesDialog(props: { config: Config; onClose: () => void; onChange: (patch: Partial<Config>) => void }) {
  const c = props.config
  const set = (patch: Partial<Config>) => props.onChange(patch)
  return (
    <Shell title="偏好设置" onClose={props.onClose} wide foot={<button className="konai-btn primary" onClick={props.onClose}>完成</button>}>
      <div className="konai-section-title">外观</div>
      <div className="konai-field"><label>主题</label>
        <select className="konai-select" value={c.theme} onChange={(e) => set({ theme: e.target.value })}>
          {THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="konai-field"><label>字体</label>
        <select className="konai-select" value={c.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
          <option value="system">系统默认（无衬线）</option>
          <option value="serif">衬线（Georgia / 宋体）</option>
          <option value="sans">无衬线（Segoe UI）</option>
          <option value="mono">等宽</option>
        </select>
      </div>
      <div className="konai-field"><label>字号</label>
        <input className="konai-input" type="number" min={10} max={32} value={c.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })} />
      </div>
      <div className="konai-field"><label>内容宽度</label>
        <input className="konai-input" type="number" min={480} max={1400} value={c.contentWidth} onChange={(e) => set({ contentWidth: Number(e.target.value) })} />
      </div>
      <div className="konai-field"><label>行高</label>
        <input className="konai-input" type="number" step={0.05} min={1} max={2.5} value={c.lineHeight} onChange={(e) => set({ lineHeight: Number(e.target.value) })} />
      </div>

      <div className="konai-section-title">Markdown</div>
      <div className="konai-field"><label>高亮 ==…==</label><input type="checkbox" checked={!!c.highlight} onChange={(e) => set({ highlight: e.target.checked })} /></div>
      <div className="konai-field"><label>上标 ^…^</label><input type="checkbox" checked={!!c.superscript} onChange={(e) => set({ superscript: e.target.checked })} /></div>
      <div className="konai-field"><label>下标 ~…~</label><input type="checkbox" checked={!!c.subscript} onChange={(e) => set({ subscript: e.target.checked })} /></div>
      <div className="konai-field"><label>Emoji 短代码</label><input type="checkbox" checked={c.emoji !== false} onChange={(e) => set({ emoji: e.target.checked })} /></div>
      <div className="konai-field"><label>智能标点</label><input type="checkbox" checked={!!c.smartPunctuation} onChange={(e) => set({ smartPunctuation: e.target.checked })} /></div>
      <div className="konai-field"><label>自动配对</label><input type="checkbox" checked={c.autoPair !== false} onChange={(e) => set({ autoPair: e.target.checked })} /></div>
      <div className="konai-field"><label>LaTeX \(…\) \[…\]</label><input type="checkbox" checked={c.latexDelimiters !== false} onChange={(e) => set({ latexDelimiters: e.target.checked })} /></div>
      <div className="konai-field"><label>数学自动编号</label>
        <select className="konai-select" value={c.autoNumberMath} onChange={(e) => set({ autoNumberMath: e.target.value as any })}>
          <option value="none">无</option><option value="ams">AMS 规则</option><option value="all">全部</option>
        </select>
      </div>
      <div className="konai-field"><label>代码块行号</label><input type="checkbox" checked={!!c.codeLineNumbers} onChange={(e) => set({ codeLineNumbers: e.target.checked })} /></div>

      <div className="konai-section-title">文件与侧边栏</div>
      <div className="konai-field"><label>自动保存（分钟）</label>
        <input className="konai-input" type="number" min={0} max={60} value={c.autoSaveTimer} onChange={(e) => set({ autoSaveTimer: Number(e.target.value) })} />
      </div>
      <div className="konai-field"><label>显示隐藏文件</label><input type="checkbox" checked={!!c.showHiddenFiles} onChange={(e) => set({ showHiddenFiles: e.target.checked })} /></div>
      <div className="konai-field"><label>显示所有文件</label><input type="checkbox" checked={!!c.showAllFiles} onChange={(e) => set({ showAllFiles: e.target.checked })} /></div>
      <div className="konai-field"><label>排序方式</label>
        <select className="konai-select" value={c.sortBy} onChange={(e) => set({ sortBy: e.target.value as any })}>
          <option value="name">名称</option><option value="modified">修改时间</option><option value="created">创建时间</option>
        </select>
      </div>
      <div className="konai-field"><label>侧边栏宽度</label>
        <input className="konai-input" type="number" min={160} max={520} value={c.sidebarWidth} onChange={(e) => set({ sidebarWidth: Number(e.target.value) })} />
      </div>
      <div className="konai-hint">设置立即生效并写入 conf.user.json。</div>
    </Shell>
  )
}

export function ExportDialog(props: { text: string; title: string; theme: string; dark: boolean; docDir: string; onClose: () => void; onToast: (s: string) => void }) {
  const [format, setFormat] = useState<'html' | 'htmlPlain' | 'pdf' | 'docx' | 'image'>('pdf')
  const [pageSize, setPageSize] = useState('A4')
  const [margin, setMargin] = useState({ top: 20, bottom: 20, left: 18, right: 18 })
  const [header, setHeader] = useState('')
  const [footer, setFooter] = useState('{{page}} / {{total}}')
  const [pageBreak, setPageBreak] = useState(false)
  const [printBackground, setPrintBackground] = useState(true)
  const [bookmarks, setBookmarks] = useState(true)
  const [mathMode, setMathMode] = useState<'svg' | 'latex'>('svg')
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const ext = format === 'docx' ? '.docx' : format === 'image' ? '.png' : format === 'pdf' ? '.pdf' : '.html'
      const path = await window.konai.app.showSaveDialog({ defaultPath: props.title + ext, filters: [{ name: '输出文件', extensions: [ext.replace(/^\./, '')] }] })
      if (!path) { setBusy(false); return }
      if (format === 'docx') {
        const r = await window.konai.export.docx({ path, text: props.text, title: props.title })
        props.onToast('已导出：' + r.path)
      } else if (format === 'image') {
        const html = (await buildExportHtml(props.text, { docDir: props.docDir, theme: props.theme, dark: props.dark, mathMode, styled: true, title: props.title, pageBreak })).html
        await window.konai.export.image({ path, dataUrl: '', width: 1000, height: 1400 }, html)
        props.onToast('已导出：' + path)
      } else if (format === 'pdf') {
        const res = await buildExportHtml(props.text, { docDir: props.docDir, theme: props.theme, dark: props.dark, mathMode, styled: true, title: props.title, pageBreak })
        const r = await window.konai.export.pdf({
          path, text: props.text, title: props.title, theme: props.theme, dark: props.dark,
          pageSize, margin, header, footer, pageBreak, printBackground, bookmarks,
        }, res.bookmarks, res.html)
        props.onToast('已导出：' + r.path + (r.warnings.length ? '（' + r.warnings.join('; ') + '）' : ''))
      } else {
        const res = await buildExportHtml(props.text, { docDir: props.docDir, theme: props.theme, dark: props.dark, mathMode, styled: format === 'html', title: props.title, pageBreak })
        await window.konai.export.writeHtml(path, res.html)
        props.onToast('已导出：' + path)
      }
      props.onClose()
    } catch (e) {
      props.onToast('导出失败：' + String(e))
    } finally { setBusy(false) }
  }

  return (
    <Shell title="导出" onClose={props.onClose} wide
      foot={<><button className="konai-btn" onClick={props.onClose}>取消</button><button className="konai-btn primary" disabled={busy} onClick={run}>{busy ? '导出中…' : '导出'}</button></>}>
      <div className="konai-field"><label>目标格式</label>
        <select className="konai-select" value={format} onChange={(e) => setFormat(e.target.value as any)}>
          <option value="pdf">PDF</option>
          <option value="html">HTML（含样式）</option>
          <option value="htmlPlain">HTML（无样式）</option>
          <option value="docx">Word (.docx)</option>
          <option value="image">图片 (PNG)</option>
        </select>
      </div>
      {format === 'pdf' ? (
        <>
          <div className="konai-field"><label>纸张</label>
            <select className="konai-select" value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
              {['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="konai-field"><label>页边距(mm)</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="konai-input" type="number" value={margin.top} onChange={(e) => setMargin({ ...margin, top: Number(e.target.value) })} title="上" />
              <input className="konai-input" type="number" value={margin.bottom} onChange={(e) => setMargin({ ...margin, bottom: Number(e.target.value) })} title="下" />
              <input className="konai-input" type="number" value={margin.left} onChange={(e) => setMargin({ ...margin, left: Number(e.target.value) })} title="左" />
              <input className="konai-input" type="number" value={margin.right} onChange={(e) => setMargin({ ...margin, right: Number(e.target.value) })} title="右" />
            </div>
          </div>
          <div className="konai-field"><label>页眉</label><input className="konai-input" value={header} onChange={(e) => setHeader(e.target.value)} placeholder="留空则无页眉" /></div>
          <div className="konai-field"><label>页脚</label><input className="konai-input" value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="支持 {{page}} {{total}} {{title}} {{date}}" /></div>
          <div className="konai-field"><label>标题前分页</label><input type="checkbox" checked={pageBreak} onChange={(e) => setPageBreak(e.target.checked)} /></div>
          <div className="konai-field"><label>打印背景</label><input type="checkbox" checked={printBackground} onChange={(e) => setPrintBackground(e.target.checked)} /></div>
          <div className="konai-field"><label>附加 PDF 书签</label><input type="checkbox" checked={bookmarks} onChange={(e) => setBookmarks(e.target.checked)} /></div>
        </>
      ) : null}
      {format === 'html' || format === 'htmlPlain' ? (
        <div className="konai-field"><label>数学输出</label>
          <select className="konai-select" value={mathMode} onChange={(e) => setMathMode(e.target.value as any)}>
            <option value="svg">渲染 SVG</option><option value="latex">LaTeX 源码</option>
          </select>
        </div>
      ) : null}
      <div className="konai-hint">HTML 导出不依赖 Pandoc；docx 使用内置写入器。</div>
    </Shell>
  )
}

export function QuickOpenDialog(props: { root: string; onClose: () => void; onOpen: (path: string) => void }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [sel, setSel] = useState(0)
  useEffect(() => {
    if (!props.root) return
    const t = setTimeout(async () => { setItems(await window.konai.fs.quickOpen(q, props.root)); setSel(0) }, 60)
    return () => clearTimeout(t)
  }, [q, props.root])
  const pick = (p: string) => { props.onOpen(p); props.onClose() }
  return (
    <div className="konai-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) props.onClose() }}>
      <div className="konai-dialog" style={{ width: 560 }}>
        <input className="konai-quickopen-input" autoFocus placeholder="搜索文件名或路径…" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)) }
            else if (e.key === 'Enter') { if (items[sel]) pick(items[sel].path) }
            else if (e.key === 'Escape') props.onClose()
          }} />
        <div className="konai-quickopen-list">
          {items.map((it, i) => (
            <div key={it.path} className={'konai-quickopen-item' + (i === sel ? ' active' : '')} onMouseEnter={() => setSel(i)} onClick={() => pick(it.path)}>
              <span className="n">{it.name}</span><span className="d">{it.dir}</span>
            </div>
          ))}
          {!items.length ? <div className="konai-empty">无匹配</div> : null}
        </div>
      </div>
    </div>
  )
}

export function GlobalSearchDialog(props: { root: string; onClose: () => void; onOpen: (path: string, line: number) => void }) {
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState({ regex: false, caseSensitive: false, wholeWord: false })
  const [results, setResults] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (!q) return
    setBusy(true)
    try { setResults(await window.konai.fs.search(q, props.root, opts)) } finally { setBusy(false) }
  }
  return (
    <Shell title="全局搜索" onClose={props.onClose} wide
      foot={<><button className="konai-btn" onClick={props.onClose}>关闭</button><button className="konai-btn primary" onClick={run}>搜索</button></>}>
      <div className="konai-field"><label>关键词</label><input className="konai-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} /></div>
      <div className="konai-field">
        <label>选项</label>
        <label style={{ width: 'auto' }}><input type="checkbox" checked={opts.regex} onChange={(e) => setOpts({ ...opts, regex: e.target.checked })} /> 正则</label>
        <label style={{ width: 'auto' }}><input type="checkbox" checked={opts.caseSensitive} onChange={(e) => setOpts({ ...opts, caseSensitive: e.target.checked })} /> 区分大小写</label>
        <label style={{ width: 'auto' }}><input type="checkbox" checked={opts.wholeWord} onChange={(e) => setOpts({ ...opts, wholeWord: e.target.checked })} /> 全词</label>
      </div>
      <div className="konai-search-results">
        {busy ? <div className="konai-spinner">搜索中…</div> : results.map((r, i) => (
          <div key={i} className="konai-search-item" onClick={() => props.onOpen(r.path, r.line)}>
            <div className="loc">{r.name}:{r.line}:{r.column}</div>
            <div className="txt">{r.text}</div>
          </div>
        ))}
        {!busy && results.length === 0 ? <div className="konai-empty">输入关键词后搜索</div> : null}
      </div>
    </Shell>
  )
}

export function AboutDialog(props: { onClose: () => void }) {
  return (
    <Shell title="关于 Konai" onClose={props.onClose} foot={<button className="konai-btn primary" onClick={props.onClose}>确定</button>}>
      <div style={{ lineHeight: 1.9 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Konai</div>
        <div>版本 1.0.0（Windows x64）</div>
        <div>一个完全免费、无激活、无遥测的 Markdown 编辑器。</div>
        <div style={{ color: 'var(--konai-text-muted)', fontSize: 12, marginTop: 10 }}>
          本程序为净室实现，未使用任何第三方商业软件的图标、主题、字体或代码。
        </div>
      </div>
    </Shell>
  )
}
