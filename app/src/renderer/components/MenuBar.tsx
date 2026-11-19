
import React, { useState, useRef, useEffect } from 'react'

export interface MenuItem {
  id?: string
  label?: string
  shortcut?: string
  type?: 'item' | 'sep' | 'submenu' | 'check'
  checked?: boolean
  children?: MenuItem[]
  disabled?: boolean
}

export const MENUS: Array<MenuItem & { label: string }> = [
  {
    label: '文件',
    children: [
      { id: 'file.new', label: '新建', shortcut: 'Ctrl+N' },
      { id: 'file.newTab', label: '新建标签页', shortcut: 'Ctrl+T' },
      { id: 'file.newWindow', label: '新建窗口', shortcut: 'Ctrl+Shift+N' },
      { type: 'sep' },
      { id: 'file.open', label: '打开文件…', shortcut: 'Ctrl+O' },
      { id: 'file.openFolder', label: '打开文件夹…', shortcut: 'Ctrl+Shift+O' },
      { type: 'sep' },
      { id: 'file.save', label: '保存', shortcut: 'Ctrl+S' },
      { id: 'file.saveAs', label: '另存为…', shortcut: 'Ctrl+Shift+S' },
      { type: 'sep' },
      { type: 'submenu', label: '导出', children: [
        { id: 'export.html', label: 'HTML（含样式）' },
        { id: 'export.htmlPlain', label: 'HTML（无样式）' },
        { id: 'export.pdf', label: 'PDF…' },
        { id: 'export.docx', label: 'Word (.docx)…' },
        { id: 'export.image', label: '图片…' },
      ] },
      { id: 'file.print', label: '打印…', shortcut: 'Ctrl+P' },
      { type: 'sep' },
      { id: 'file.closeTab', label: '关闭标签页', shortcut: 'Ctrl+W' },
      { id: 'file.reopenClosed', label: '恢复关闭的文件', shortcut: 'Ctrl+Shift+T' },
      { id: 'app.quit', label: '退出', shortcut: 'Alt+F4' },
    ],
  },
  {
    label: '编辑',
    children: [
      { id: 'edit.undo', label: '撤销', shortcut: 'Ctrl+Z' },
      { id: 'edit.redo', label: '重做', shortcut: 'Ctrl+Y' },
      { type: 'sep' },
      { id: 'edit.cut', label: '剪切', shortcut: 'Ctrl+X' },
      { id: 'edit.copy', label: '复制', shortcut: 'Ctrl+C' },
      { id: 'edit.paste', label: '粘贴', shortcut: 'Ctrl+V' },
      { id: 'edit.selectAll', label: '全选', shortcut: 'Ctrl+A' },
      { type: 'sep' },
      { id: 'edit.find', label: '查找', shortcut: 'Ctrl+F' },
      { id: 'edit.replace', label: '替换', shortcut: 'Ctrl+H' },
      { type: 'sep' },
      { type: 'submenu', label: '复制为', children: [
        { id: 'edit.copyMarkdown', label: 'Markdown' },
        { id: 'edit.copyHtml', label: 'HTML 代码' },
        { id: 'edit.copyPlainText', label: '纯文本' },
        { id: 'edit.copyNoStyle', label: '无主题样式' },
      ] },
      { type: 'sep' },
      { id: 'edit.readonly', label: '只读模式', type: 'check', checked: false },
    ],
  },
  {
    label: '段落',
    children: [
      { id: 'paragraph.h1', label: '标题 1', shortcut: 'Alt+1' },
      { id: 'paragraph.h2', label: '标题 2', shortcut: 'Alt+2' },
      { id: 'paragraph.h3', label: '标题 3', shortcut: 'Alt+3' },
      { id: 'paragraph.h4', label: '标题 4', shortcut: 'Alt+4' },
      { id: 'paragraph.h5', label: '标题 5', shortcut: 'Alt+5' },
      { id: 'paragraph.h6', label: '标题 6', shortcut: 'Alt+6' },
      { type: 'sep' },
      { id: 'paragraph.increaseHeading', label: '增加标题层级' },
      { id: 'paragraph.decreaseHeading', label: '降低标题层级' },
      { type: 'sep' },
      { id: 'paragraph.ul', label: '无序列表' },
      { id: 'paragraph.ol', label: '有序列表' },
      { id: 'paragraph.task', label: '任务列表' },
      { id: 'paragraph.quote', label: '引用块' },
      { id: 'paragraph.code', label: '代码块' },
      { id: 'paragraph.table', label: '表格' },
      { id: 'paragraph.indent', label: '增加缩进', shortcut: 'Tab' },
      { id: 'paragraph.outdent', label: '减少缩进', shortcut: 'Shift+Tab' },
      { type: 'sep' },
      { id: 'paragraph.toggleTask', label: '切换任务状态' },
    ],
  },
  {
    label: '格式',
    children: [
      { id: 'format.bold', label: '粗体', shortcut: 'Ctrl+B' },
      { id: 'format.italic', label: '斜体', shortcut: 'Ctrl+I' },
      { id: 'format.strike', label: '删除线', shortcut: 'Ctrl+Shift+S' },
      { id: 'format.code', label: '行内代码', shortcut: 'Ctrl+E' },
      { id: 'format.link', label: '链接', shortcut: 'Ctrl+K' },
      { id: 'format.image', label: '图片' },
      { id: 'format.underline', label: '下划线' },
      { id: 'format.highlight', label: '高亮' },
      { id: 'format.emoji', label: 'Emoji' },
    ],
  },
  {
    label: '视图',
    children: [
      { id: 'view.source', label: '源码模式', shortcut: 'Ctrl+/' },
      { id: 'view.focus', label: '专注模式', type: 'check', checked: false },
      { id: 'view.typewriter', label: '打字机模式', type: 'check', checked: false },
      { type: 'sep' },
      { id: 'view.sidebar', label: '侧边栏', type: 'check', checked: true },
      { id: 'view.statusbar', label: '状态栏', type: 'check', checked: true },
      { type: 'sep' },
      { id: 'view.zoomIn', label: '放大', shortcut: 'Ctrl+=' },
      { id: 'view.zoomOut', label: '缩小', shortcut: 'Ctrl+-' },
      { id: 'view.zoomReset', label: '实际大小', shortcut: 'Ctrl+0' },
      { type: 'sep' },
      { id: 'view.fullscreen', label: '全屏', shortcut: 'F11' },
      { id: 'view.alwaysOnTop', label: '总是置顶', type: 'check', checked: false },
    ],
  },
  {
    label: '主题',
    children: [
      { id: 'theme.github', label: 'GitHub', type: 'check' },
      { id: 'theme.newsprint', label: 'Newsprint', type: 'check' },
      { id: 'theme.night', label: 'Night', type: 'check' },
      { id: 'theme.pixyll', label: 'Pixyll', type: 'check' },
      { id: 'theme.whitey', label: 'Whitey', type: 'check' },
      { type: 'sep' },
      { id: 'theme.openFolder', label: '打开主题文件夹' },
      { id: 'theme.customCss', label: '打开自定义 CSS 说明' },
    ],
  },
  {
    label: '帮助',
    children: [
      { id: 'help.quickStart', label: '快速上手' },
      { id: 'help.markdownReference', label: 'Markdown 参考' },
      { type: 'sep' },
      { id: 'help.checkUpdates', label: '检查更新…' },
      { id: 'help.about', label: '关于 Konai' },
    ],
  },
]

export function MenuBar(props: { onCommand: (id: string) => void }) {
  const [open, setOpen] = useState<number | null>(null)
  const [sub, setSub] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const renderRow = (item: MenuItem, key: string) => {
    if (item.type === 'sep') return <div key={key} className="konai-menu-sep" />
    const cls = 'konai-menu-row' + (item.disabled ? ' disabled' : '')
    const hasSub = item.type === 'submenu'
    return (
      <div
        key={key}
        className={cls}
        onMouseEnter={() => { if (hasSub) setSub(key) }}
        onClick={(e) => {
          e.stopPropagation()
          if (hasSub) { setSub(sub === key ? null : key); return }
          if (item.id) props.onCommand(item.id)
          setOpen(null); setSub(null)
        }}
      >
        {item.type === 'check' ? <span className="konai-menu-check">{item.checked ? '✓' : ''}</span> : <span className="konai-menu-check" />}
        <span className="konai-menu-label">{item.label}</span>
        {item.shortcut ? <span className="konai-menu-short">{item.shortcut}</span> : null}
        {hasSub ? <span className="konai-menu-short">▶</span> : null}
        {hasSub && sub === key ? (
          <div className="konai-menu-dropdown right" style={{ top: 0, left: '100%' }}>
            {item.children?.map((c, i) => renderRow(c, key + '-' + i))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="konai-menubar" ref={ref}>
      <span className="konai-brand">K</span>
      {MENUS.map((m, i) => (
        <div
          key={m.label}
          className={'konai-menu-item' + (open === i ? ' open' : '')}
          onClick={() => setOpen(open === i ? null : i)}
          onMouseEnter={() => { if (open !== null) setOpen(i) }}
        >
          {m.label}
          {open === i ? (
            <div className="konai-menu-dropdown">
              {m.children?.map((c, j) => renderRow(c, i + '-' + j))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
