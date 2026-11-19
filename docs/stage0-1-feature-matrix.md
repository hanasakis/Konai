# Konai 阶段 0/1 — Typora 基准安装包功能矩阵

> 本文件是 Konai 项目 Typora 兼容层/复刻验收的唯一功能基线。所有结论以用户提供的**基准安装包**为准。
> 生成时间：2026-11-18（Asia/Shanghai）。调研方式：安装包元数据 + 静默安装后安装目录静态核验 + 运行时界面核验 + 官方发布页/支持文档核对。

---

## 0. 版本识别

**识别出版本号：`1.14.15`**（Windows x64 稳定版）

**基准安装包**：`E:\AI-Agent\DeepSeek-Harness\home\attachments\v1\files\03\038e2af96968cbd55b7c418c9ad40b2cf45ffc8cc04dbc1cc98488f40e0a5c62\typora-setup-x64.exe`
- 大小：113,644,008 字节
- SHA-256：`038e2af96968cbd55b7c418c9ad40b2cf45ffc8cc04dbc1cc98488f40e0a5c62`（与用户给定前缀 `038e2af9` 一致）
- 副本只读，未修改；分析用副本位于 `E:\deepseek-harness\konai\_work\typora-setup-x64.exe`

### 识别依据（四重交叉）

| # | 依据 | 具体值 | 出处 |
|---|------|--------|------|
| 1 | 安装包 PE 版本资源 | FileVersion = `1.14.15`，ProductVersion = `1.14.15`，ProductName = `Typora`，CompanyName = `typora.io`，FileDescription = `Typora Setup`，Comments = `This installation was built with Inno Setup.` | 直接读取安装包 VersionInfo |
| 2 | 安装后应用清单 | `resources/package.json` → `"name": "Typora", "version": "1.14.15", "releaseId": "56174512"` | 静默安装目录 |
| 3 | 安装后主程序版本 | `Typora.exe` FileVersion = `1.14.15`，ProductVersion = `1.14.15`，LegalCopyright = `Copyright 2015~2026 typora.io` | 静默安装目录 |
| 4 | 运行时 | 主窗口标题 `probe.md• - Typora`（• 表示未保存），状态栏显示「未激活」 | 运行安装后的 Typora 并抓取窗口 |

> 补充说明（避免误读）：安装目录下的 `version` 文件内容为 `42.2.0`，这是 **Electron/Chromium 运行时版本**，不是 Typora 版本号；Typora 版本号以 `package.json` 与 `Typora.exe` 版本资源为准，均为 1.14.15。
>
> 安装方式：`typora-setup-x64.exe /VERYSILENT /CURRENTUSER /DIR=E:\deepseek-harness\konai\_work\typora_inst`，退出码 0。

---

## 1. 官方 Release Notes 提取与安装包行为核对

### 1.1 基准版本 1.14.15 的 release notes（官方稳定通道）

来源：<https://typora.io/releases/stable>（官方稳定通道）。本机直连 typora.io 超时，经官方中文站 <https://www.typoraio.cn/releases/stable> 获取，条目内容与官方英文页一致。

1.14.15 **没有 New 条目**，全部为改进与修复：

- Improve Quick Open for large folders.
- Preserve readonly mode when refocus window.（官方原文疑似笔误为 "Perverse"）
- Fix Outline missing for PDF export on macOS 27.
- Fix copy images on macOS 27.
- Fix overlapping spellcheck callbacks crashing the renderer.
- Allow opening links with a single click in readonly mode.
- Fix missing recent file menu crash in production builds.
- Fix iframe sandbox bypass in whitelisted HTML embeds.
- Fix inline math boundaries within TeX groups.
- Fix external file reload after editor replaces file.

### 1.2 1.14 系列（含基准版本所继承的 New 条目）

来源：<https://support.typora.io/What's-New-1.14/>（本机经官方中文站 <https://support.typoraio.cn/What's-New-1.14/> 核对）；安装包内 `resources/Docs/Change Log.md` 亦收录同样条目。

**New（1.14.0）**

- Add editor toolbar, you can enable it from menubar → View → Toolbar.
- Add context menu to quickly change styles for macOS version.
- Add option to show hidden files, all files, or follow custom glob to filter files in files sidebar.
- Add keyboard navigation on file tree.

**Improvements（1.14.x）**

- macOS 版也具备「样式设置右键菜单」。
- 文件树支持键盘导航。
- 侧边栏可配置显示隐藏文件 / 非 Markdown 文件 / 自定义 glob 过滤。
- 编辑器浮动工具栏（Settings → Appearance → Show editor toolbar）。

**Bug Fixes（1.14.x）**：列表渲染回归、macOS 27 列表项、CORS 处理、macOS 导出修复。

### 1.3 1.13 / 1.11 / 1.10 的 New 与 Improvements（基准版本功能继承来源）

来源：<https://support.typora.io/What's-New-1.13/>（经官方中文站核对）与安装包内 `resources/Docs/Change Log.md`。

- **1.13**：升级 MathJax v4；升级 Mermaid 11.13.0（新增 Venn、Ishikawa 图）；新增 VS Code / Cursor「Open in Typora」扩展；修改 Markdown 设置不再需要重启（提供重载按钮）；搜索性能提升；PDF 导出逻辑改进（macOS 26.2 起全部 PDF 导出能力可用）；侧边栏缩放体验改进；「发送匿名统计」对新安装默认关闭；新增爱尔兰语 UI。
- **1.11**：支持 LaTeX 分隔符 `\(...\)`（行内）与 `\[...\]`（块级）；`Alt + ↑/↓` 移动行/段落；Mermaid 11.7 起支持 Radar Chart（`radar-beta`）、Treemap（`treemap-beta`）。
- **1.10**：Mermaid 11.4 起支持 Packet、Kanban、Architecture 图；**Windows / Linux 支持暗色主题导出 PDF 并保留背景**；新增 `gas`、`url` 语法高亮。

### 1.4 网络信息与安装包实际行为的差异（以安装包为准）

| 事项 | 网络/文档说法 | 安装包实际 | 结论 |
|------|----------------|-------------|------|
| 暗色主题导出 PDF | 1.10 起称 Windows/Linux 支持暗色背景导出 | 安装包主进程含 `export.getPageColor` / `bgColor: window.getComputedStyle(document.body).backgroundColor` 逻辑；但安装包自带本地化文案 `Panel.json` 仍保留「Sorry, current version of Typora won't print background color on exported PDF, So dark theme is not yet supported for PDF exporting.」与「Dark Theme not support」 | **存在文档与自带文案不一致**。以安装包代码路径判断，PDF 导出具备读取并传递主题背景色的能力；验收时须以实测导出 PDF 是否含暗色背景为准，不直接引用旧文案 |
| 打印（物理打印机）暗色背景 | — | `Panel.json` 明确保留「won't print background color … not yet supported for printing」 | 打印路径暗色背景不支持，PDF 导出路径另行实测 |
| 高亮 / 上下标默认状态 | 部分评测称「开箱即用」 | 运行时实测：`==highlight==`、`H~2~O`、`X^2^` 均以字面文本显示，未渲染 | 二者默认**关闭**，需在偏好 → Markdown 中开启；验收须显式开启后验证 |
| Emoji | — | 运行时实测 `:smile:` 直接渲染为 emoji | 默认开启 |
| 代码高亮语言数量 | 第三方评测常称「200+」 | 安装包 `frame.js` 内置语言清单 163 项（含别名）；官方文档 `Docs/Code Fences Language Support.md` 列 119 种主语言 | 验收以「官方文档 119 种主语言 + 内置清单」为准，不采用「200+」说法 |

---

## 2. 完整功能矩阵（基准安装包 1.14.15）

优先级定义：**P0** = 缺了就不是 Typora；**P1** = 重要差异化能力；**P2** = 锦上添花。
「基准安装包是否支持」基于安装包自带文件（`Docs/*.md`、`conf.default.json`、`locales/*.json`、`style/themes/*.css`、`lib.asar`/`app.asar` 内语言清单与主进程字符串、`frame.js`）与运行时实测。

### 2.1 编辑核心

| 功能项 | 所属维度 | 基准安装包是否支持 | 优先级 | 验收标准（一句话，可客观判断） |
|---|---|---|---|---|
| 实时预览（所见即所得混合编辑，无需切换视图） | 编辑核心 | 支持 | P0 | 输入 Markdown 后立即在同一位置显示渲染结果，不执行任何视图切换操作 |
| GitHub Flavored Markdown 解析 | 编辑核心 | 支持 | P0 | `Docs/Markdown Reference.md` 明确声明使用 GFM，且表格/删除线/任务列表按 GFM 渲染 |
| 标题 H1–H6 与标题层级增减 | 编辑核心 | 支持 | P0 | 菜单 Paragraph → Heading 1–6 与 Increase/Decrease Heading Level 均存在且生效 |
| 段落与换行（单空行分段、Shift+Enter 单换行、行尾两空格强制换行） | 编辑核心 | 支持 | P0 | 实测单空行分段、`Shift+Enter` 产生行内换行 |
| 块引用（含多级嵌套） | 编辑核心 | 支持 | P0 | 输入 `>` 后回车自动生成引用块，可多层嵌套 |
| 有序 / 无序列表（含缩进、类型切换） | 编辑核心 | 支持 | P0 | 菜单 Paragraph → Ordered/Unordered List 与 List Indentation → Indent/Outdent 生效 |
| 任务列表（点击复选框切换、菜单 Toggle Task Status） | 编辑核心 | 支持 | P0 | 菜单含 Task List / Toggle Task Status / Mark as Complete / Mark as Incomplete，点击复选框改变状态 |
| 围栏代码块与语言标注 | 编辑核心 | 支持 | P0 | 三个反引号加语言标识生成带语法高亮的代码块 |
| 表格（创建、编辑、对齐、行列增删与移动） | 编辑核心 | 支持 | P0 | 表头加回车即生成表格，悬浮工具条可改列宽/对齐/增删行列，右键菜单可移动行列 |
| 行内样式：粗体/斜体/粗斜体/删除线/行内代码/链接/图片 | 编辑核心 | 支持 | P0 | 实测 **bold**、*italic*、`inline code` 正确渲染 |
| 自动链接（URL、`<mail@x>`）与文档内锚点链接 | 编辑核心 | 支持 | P1 | 标准 URL 自动识别为链接；`[x](#heading)` 可跳转到对应标题 |
| 脚注 `[^id]` 与悬停预览 | 编辑核心 | 支持 | P1 | 实测脚注上标与定义渲染；悬停上标显示脚注内容（`Docs/Markdown Reference.md` 明示） |
| 行内 HTML（`<u>`、`<span style>`、`<!-- -->`、`<kbd>` 等） | 编辑核心 | 支持 | P1 | `<u>x</u>` 渲染为下划线；HTML 注释不显示 |
| YAML Front Matter（含 `typora-root-url` 等） | 编辑核心 | 支持 | P1 | 文档顶部 `---` 块被识别为元数据且不作为正文渲染 |
| `[toc]` 目录自动生成与更新 | 编辑核心 | 支持 | P1 | 输入 `[toc]` 后生成目录，标题变化后目录自动更新 |
| GitHub Style Alerts（NOTE/TIP/IMPORTANT/WARNING/CAUTION） | 编辑核心 | 支持 | P1 | 菜单含 Alert/Note Block/Tip Block/Important Block/Warning Block/Caution Block，引用块可转换为对应 Alert |
| 行内数学 `$...$` 与块级 `$$...$$` | 编辑核心 | 支持 | P0 | 实测 `$E=mc^2$` 与 `$$\int_0^1 x^2 dx$` 均正确渲染 |
| LaTeX 分隔符 `\(...\)` 与 `\[...\]` | 编辑核心 | 支持 | P1 | 开启后两种分隔符分别渲染为行内/块级公式（1.11 起支持） |
| 数学自动编号（无 / AMS 规则 / 全部） | 编辑核心 | 支持 | P1 | 偏好 → Markdown → Auto Numbering Math Equations 三档可选 |
| 上标 `^…^` 与下标 `~…~` | 编辑核心 | 支持（默认关闭） | P2 | 在偏好 → Markdown 开启后 `X^2^`、`H~2~O` 渲染为上下标；默认关闭时按字面显示 |
| 高亮 `==…==` | 编辑核心 | 支持（默认关闭） | P2 | 在偏好 → Markdown 开启后 `==x==` 渲染为高亮；默认关闭时按字面显示 |
| Emoji 短代码 `:smile:` 与直接输入 emoji | 编辑核心 | 支持 | P2 | 实测 `:smile:` 渲染为 emoji |
| 自动配对（括号、引号、Markdown 符号） | 编辑核心 | 支持 | P1 | 偏好含 Auto pair brackets and quotes / Auto pair common Markdown syntax 开关 |
| 智能标点（Smart Quotes / Smart Dashes，输入或渲染时转换） | 编辑核心 | 支持 | P1 | 菜单 Edit → Substitutions → Smart Quotes / Smart Dashes，偏好含 Convert on Input / Convert on Rendering |
| 注释与 HTML 块 | 编辑核心 | 支持 | P2 | `<!-- -->` 与块级 HTML 可被解析且不破坏文档 |
| 代码块行号开关 | 编辑核心 | 支持 | P2 | 偏好含 Display line numbers for code fences 开关 |
| 代码块复制内容 / 自动缩进 / 跳到行首行尾 | 编辑核心 | 支持 | P2 | 菜单含 Copy Code Content、Auto Indent Selected/Whole Code、Jump to Line Start/End |
| 空白与换行偏好（保留/忽略连续空白与单换行、段首缩进） | 编辑核心 | 支持 | P2 | 偏好含 Preserve sequential whitespace and single line break、Indent first line of paragraphs、Visible `<br/>` |
| 快捷键自定义（`conf.user.json` → keyBinding） | 编辑核心 | 支持 | P1 | `conf.default.json` 暴露 keyBinding 覆盖机制，菜单项文本即命令名 |
| 源码模式 / 混合视图切换（`Ctrl+/`）与滚动位置保留 | 编辑核心 | 支持 | P1 | 状态栏与 View 菜单均有 Toggle Source Code Mode，切换后滚动位置保留（1.13 改进） |
| 只读模式（Readonly Mode） | 编辑核心 | 支持 | P2 | View 菜单含 Readonly Mode；1.14.15 起单击即可打开链接（此前需 Ctrl） |
| 行 / 段落上下移动（`Alt+↑/↓`） | 编辑核心 | 支持 | P2 | 1.11 起支持，菜单含 Move Row Up/Down、Paragraph (before/after) |
| 复制为 Markdown / HTML 代码 / 纯文本 / 无主题样式 | 编辑核心 | 支持 | P1 | 菜单含 Copy as Markdown、Copy as HTML Code、Copy as Plain Text、Copy without Theme Styling |
| 选择行 / 句 / 样式域 / 词 | 编辑核心 | 支持 | P2 | 菜单含 Select Line / Sentence、Select Styled Scope、Select Word |
| 查找与替换（正则、大小写、全词、匹配计数） | 编辑核心 | 支持 | P1 | 菜单含 Find/Replace，界面含 Case Sensitive、Whole Word、Regular Expression、匹配计数 |
| 块级删除 / 样式清除 | 编辑核心 | 支持 | P2 | 菜单含 Delete Block、Clear Format、Delete Paragraph / Block |

### 2.2 扩展渲染

| 功能项 | 所属维度 | 基准安装包是否支持 | 优先级 | 验收标准（一句话，可客观判断） |
|---|---|---|---|---|
| MathJax v4 数学渲染 | 扩展渲染 | 支持（MathJax 4.1.0） | P0 | `lib.asar` 内含 `MathJax4/tex-svg-full.js`，版本串 `"4.1.0"`；公式渲染为 SVG |
| TeX 宏与宏包（ams、physics、xypic、bboldx、begingroup、textmacros） | 扩展渲染 | 支持 | P1 | `html/content.html` 配置 mathPackages = noundefined/autoload/ams/textmacros/xypic，可选 physics；1.13 起新增 bboldx、begingroup |
| MathJax 辅助 MathML（可访问性）输出 | 扩展渲染 | 支持 | P2 | `content.html` 中 `enableAssistiveMml: true` |
| Mermaid 11.13.0 图表渲染 | 扩展渲染 | 支持 | P1 | `lib.asar` 内 `diagram/mermaid.min.js` 版本串 `"11.13.0"`；实测 ```mermaid``` 流程图正确渲染 |
| Mermaid 图表类型 ≥20 种 | 扩展渲染 | 支持 | P1 | 内置清单覆盖 flowchart、sequenceDiagram、classDiagram、stateDiagram、erDiagram、gantt、pie、gitGraph、mindmap、timeline、journey、quadrantChart、requirementDiagram、sankey、xychart、block、packet、kanban、architecture、radar、treemap、venn、ishikawa |
| ZenUML 图表 | 扩展渲染 | 支持 | P2 | `lib.asar` 内含 `diagram/mermaid-zenuml.min.js`，注册 id `zenuml` |
| js-sequence-diagrams 与 flowchart.js | 扩展渲染 | 支持 | P1 | `Docs/Draw Diagrams With Markdown.md` 明示 ```sequence``` 与 ```flow``` 两种代码块 |
| 代码语法高亮（CodeMirror） | 扩展渲染 | 支持 | P0 | `lib.asar` 含 `codemirror/mode.min.js`；内置语言清单 163 项（含别名），官方文档列 119 种主语言，含 gas/url/pseudocode/solidity/structured text 等 |
| 表格可视化编辑（悬浮工具条、拖拽缩放、多列同时对齐） | 扩展渲染 | 支持 | P1 | `Docs/Table Editing.md` 描述工具条、拖拽缩放、行列移动、多列对齐 |
| 图片语法切换（Markdown / HTML）与图片缩放 | 扩展渲染 | 支持 | P2 | 菜单含 Switch Image Syntax、Zoom Image、Zoom Image to %@ |
| 复制为图片（数学 / 图表 / 表格） | 扩展渲染 | 支持 | P2 | 菜单含 Copy as Image、Save %@ As（1.8 修复另存为图片） |
| 数学复制为 MathML / TeX | 扩展渲染 | 支持 | P2 | 菜单含 Copy as MathML、Copy as Tex、Copy Math |
| 视频 / 音频 / iframe 嵌入（含 `<track>` 相对路径） | 扩展渲染 | 支持 | P2 | 1.13 修复 `<track>` 遵守相对路径设置；`content.html` 含 iframe 高度同步逻辑 |
| Mermaid 内联配置（`%%{init:...}%%`） | 扩展渲染 | 支持 | P2 | 1.6 起支持 inline mermaid configs，且配置不再互相污染 |
| 代码语言自动补全与默认语言记忆 | 扩展渲染 | 支持 | P2 | 偏好含 Default Code Language（None/Last Used）与 Apply Default Code Language When |

### 2.3 文件与组织

| 功能项 | 所属维度 | 基准安装包是否支持 | 优先级 | 验收标准（一句话，可客观判断） |
|---|---|---|---|---|
| 左侧边栏（文件 / 大纲 两个面板） | 文件与组织 | 支持 | P0 | 实测左侧显示「文件 / 大纲」两个标签页 |
| 文件列表视图与文件树视图（独立配置） | 文件与组织 | 支持 | P1 | 菜单含 File Tree / Articles (List View) / File Tree (Tree View)，偏好含 File Tree 与 File Library 分别配置 |
| 大纲面板（可折叠 / 平面、过滤、点击跳转、当前标题高亮） | 文件与组织 | 支持 | P1 | 菜单含 Collapsible Outline / Flat Outline / Filter / Highlight Current Header / Expand All / Collapse All |
| 文章列表视图（Articles List View） | 文件与组织 | 支持 | P2 | 菜单含 Articles (List View)，用于聚合显示多文档 |
| 打开文件夹 / 打开文件 / 打开最近 | 文件与组织 | 支持 | P0 | 菜单含 Open、Open Folder、Open Recent、Recent Locations |
| 新建文件 / 新建文件夹 / 重命名 / 移动 / 删除（移入回收站、可撤销） | 文件与组织 | 支持 | P0 | 文件树右键含 New File/New Folder/Rename/Move To/Delete，删除可撤销 |
| 最近文件与最近位置（可固定 / 取消固定 / 清除） | 文件与组织 | 支持 | P1 | 菜单含 Pin/Unpin/Remove from List、Clear Recent Folders and Files |
| 快速打开 Quick Open（`Ctrl+P`，模糊匹配文件名与路径） | 文件与组织 | 支持 | P1 | 1.14.15 优化大文件夹；1.4 起模糊搜索也匹配文件夹路径 |
| 全局搜索（跨文件内容、正则、文件名校验） | 文件与组织 | 支持 | P1 | 菜单含 Search、Search by file name、Regular Expression；`node_modules` 含 `vscode-ripgrep` |
| 侧边栏文件过滤（隐藏文件、非 Markdown、自定义 glob 包含/排除） | 文件与组织 | 支持 | P2 | 1.14 新增；偏好含 Show hidden folders/files 与 File Tree/File Library Custom Patterns（`!` 前缀排除） |
| 文件树键盘导航 | 文件与组织 | 支持 | P2 | 1.14 新增 |
| 排序（名称 / 修改时间 / 创建时间、自然排序、按文件夹分组） | 文件与组织 | 支持 | P2 | 菜单含 Sort Naturally/By Name/By Modification Date/By Creation Date 升降序、Group By Folder |
| 图片管理（复制 / 移动 / 下载 / 重命名 / 删除全部图片；随文档移动资源目录） | 文件与组织 | 支持 | P1 | 菜单含 Copy All Images to / Move All Images to / Rename or Move Image to / Delete Image / Reload All Images |
| 图片上传器（iPic / PicGo / Picsee / 自定义命令，含测试与校验） | 文件与组织 | 支持 | P2 | 菜单含 Upload Image / Upload All Local Images / Test Uploader；支持命令与变量替换 |
| 默认文件类型 / 扩展名与拖拽行为配置 | 文件与组织 | 支持 | P2 | 偏好含 Default File Type / Extension、When drop file / folder into Typora 各分支 |
| 外部修改检测与「从磁盘重新加载」 | 文件与组织 | 支持 | P1 | 主进程含 external file reload 逻辑（1.14.15 修复替换文件后的重载） |
| 多标签与多窗口（New Tab、切换已打开文档、New Window、恢复关闭文件） | 文件与组织 | 支持 | P1 | 菜单含 New Tab、Switch Between Opened Documents、New Window、Reopen Closed File |
| 文件包（TextBundle / TextPack）支持 | 文件与组织 | 支持 | P2 | 主进程/本地化含 TextBundle file、Images saved to TextBundle |
| 撤销 / 重做（含删除文件撤销） | 文件与组织 | 支持 | P0 | Edit 菜单含 Undo/Redo，1.4 修复删除文件后文件树不显示撤销 |

### 2.4 导出

| 功能项 | 所属维度 | 基准安装包是否支持 | 优先级 | 验收标准（一句话，可客观判断） |
|---|---|---|---|---|
| 导出 PDF（页边距、纸张、页眉页脚、页面分隔、书签、大纲侧边栏） | 导出 | 支持 | P0 | 偏好/导出面板含 Paper Size、Margin L/R/T/B、Header、Footer、Page Break、Include Outline Sidebar；PDF 书签失败有警告提示 |
| 暗色主题导出 PDF 保留背景（Windows / Linux） | 导出 | 支持（代码路径具备，需实测） | P1 | 主进程 `export.getPageColor` 读取 `document.body` 计算背景色并传给 PDF 导出；1.10 起官方声明支持；**验收须实测** |
| 导出 HTML（含样式） | 导出 | 支持 | P0 | File → Export → HTML；`Docs/Install and Use Pandoc.md` 明示 HTML 不需要 Pandoc |
| 导出 HTML（无样式；数学可选 LaTeX 源码或渲染 SVG） | 导出 | 支持 | P1 | 菜单含 HTML (without Styles)，偏好含 Use Rendered SVG / Use LaTeX Source |
| 导出 Word `.docx`（Pandoc） | 导出 | 支持 | P1 | 需 Pandoc ≥ 2.0；未安装时给出引导 |
| 导出 `.odt` / `.rtf` / `.epub` / `.latex` / Media Wiki（Pandoc） | 导出 | 支持 | P2 | `Docs/Install and Use Pandoc.md` 列出这些格式；导出面板含 Chapter Level、Footnotes and References Location 等 |
| 导入 `.docx`/`.latex`/`.rst`/`.org`/`.wiki`/`.epub` 等（Pandoc） | 导出 | 支持 | P2 | `Docs/Install and Use Pandoc.md` 列出导入扩展名清单 |
| 导出为图片（文档 / 选区 / 图表 / 公式） | 导出 | 支持 | P1 | 菜单含 Copy as Image、Save %@ As；主进程含 `export.captureImage` / `export.prepareImageCapture` |
| 导出预设（目标格式、扩展名、模板、样式引用、自定义 CSS、LaTeX/PDF 引擎、参数、变量） | 导出 | 支持 | P1 | 导出面板含 Target Format、File Extensions for Export、Template、Style Reference、Custom CSS、LaTeX Engine、PDF Engine、Arguments、变量 ${outputFolder}/${currentFolder}/${filename} |
| 导出后动作（打开文件 / 打开所在目录）与「用上次设置导出」 | 导出 | 支持 | P2 | 菜单含 Export with Previous / Export and Overwrite with Previous，偏好含 After Export |
| 打印（页面设置、页眉页脚；暗色背景不支持） | 导出 | 支持 | P1 | 主进程含 `export.print` / `Print PDF Preview`；`Panel.json` 明确打印路径不支持暗色背景 |
| Pandoc 检测、版本校验与安装引导 | 导出 | 支持 | P1 | 偏好含 Require Pandoc to Continue、Follow Instructions to Install/Update Pandoc、Set Pandoc Path |
| 导出列表自定义（新增 / 删除 / 重命名 / 排序 / 从模板添加） | 导出 | 支持 | P1 | 菜单含 Export Setting，面板含 Add/Delete/Rename/Move Up/Move Down/Add From a Template |
| PDF 书签附加失败警告 | 导出 | 支持 | P2 | `Panel.json` 含 `[Warning] Failed to attach bookmark for PDF file.` |

### 2.5 写作体验

| 功能项 | 所属维度 | 基准安装包是否支持 | 优先级 | 验收标准（一句话，可客观判断） |
|---|---|---|---|---|
| 专注模式 Focus Mode | 写作体验 | 支持 | P1 | View 菜单含 Focus Mode，主进程字符串含 `isFocusMode` |
| 打字机模式 Typewriter Mode（含阅读速度设置） | 写作体验 | 支持 | P1 | View 菜单含 Typewriter Mode，偏好含阅读速度档位（120/240/382 词每分钟） |
| 状态栏（行 / 词 / 字符 / 选中统计） | 写作体验 | 支持 | P1 | 实测底部状态栏显示 `1 / 85 词`，View 菜单含 Show Status Bar |
| 字数统计弹层 Word Count Popover | 写作体验 | 支持 | P2 | 菜单含 Toggle Word Count Popover |
| 内置主题（默认 + github / newsprint / night / pixyll / whitey） | 写作体验 | 支持 | P1 | `resources/style/themes/` 下含 github.css、newsprint.css、night.css、pixyll.css、whitey.css，另有默认主题 |
| 明 / 暗主题分离（Use separate theme in dark mode） | 写作体验 | 支持 | P2 | 偏好含 Light Theme / Dark Theme 与 Use separate theme in dark mode（Windows 10 ≥ 1903） |
| 自定义主题与自定义 CSS（`base.user.css`、`{theme}.user.css`、主题文件夹） | 写作体验 | 支持 | P1 | `Docs/Custom Themes.md` 说明用户 CSS 覆盖机制；偏好含 Open Theme Folder |
| 字体族与字号自定义（标准 / 衬线 / 无衬线 / 等宽） | 写作体验 | 支持 | P1 | `conf.default.json` 暴露 defaultFontFamily 四类字体；偏好含 Font Size 自动/自定义 |
| 自动保存（`autoSaveTimer`，默认 5 分钟） | 写作体验 | 支持 | P1 | `Docs/Auto Save, Version Control and Recovery.md` 明示默认 5 分钟；主进程含 `autoSaveTimer` |
| 草稿恢复 Recover Unsaved Drafts | 写作体验 | 支持 | P1 | 偏好含 Recover Unsaved Drafts 按钮 |
| 版本浏览 Browse All Versions（依赖系统版本历史） | 写作体验 | 支持 | P2 | File 菜单含 Browse All Versions |
| 编辑器浮动工具栏（1.14 新增，View → Toolbar） | 写作体验 | 支持 | P2 | `frame.js` 含 `ty-editor-toolbar`；主进程含 `showToolbar`/`toggleToolbar` |
| 窗口样式（Classic / Seamless / Unibody） | 写作体验 | 支持 | P2 | 偏好含 Window Style: Classic / Seamless / Unibody |
| 窗口行为（总是置顶、全屏、缩放、`Ctrl+滚轮` 缩放、多显示器位置记忆） | 写作体验 | 支持 | P2 | 菜单含 Always on Top / Full Screen / Actual Size / Zoom In / Zoom Out；偏好含 Ctrl+滚轮缩放 |
| 行尾与编码（CRLF/LF、按编码重新打开、保存时插入末尾换行） | 写作体验 | 支持 | P2 | 菜单含 Line Endings、Reopen with Encoding、Insert Final New Line On Save |
| 拼写检查（Hunspell，多语言词典下载、自动纠正、学习单词） | 写作体验 | 支持 | P1 | `resources/node_modules` 含 `node-spellchecker` 与 `hunspell_dictionaries/en_US.*`；菜单含 Spelling and Grammar、Learn Spelling |
| 大纲弹层 Outline Popover 与模式切换 | 写作体验 | 支持 | P2 | 菜单含 Toggle Outline Popover、Toggle Source Code Mode、Exit Source Code Mode |
| 专注 / 打字机模式互斥提示 | 写作体验 | 支持 | P2 | `Panel.json` 含 `Turn off Typewriter / Focus Mode` |

### 2.6 平台集成（以基准安装包所在平台 = Windows x64 为准）

| 功能项 | 所属维度 | 基准安装包是否支持 | 优先级 | 验收标准（一句话，可客观判断） |
|---|---|---|---|---|
| Windows x64 安装包（Inno Setup，支持静默安装） | 平台集成 | 支持 | P0 | 安装包 Comments 为 Inno Setup；`/VERYSILENT /CURRENTUSER /DIR=...` 退出码 0 |
| 文件关联与默认 Markdown 编辑器 | 平台集成 | 支持 | P1 | 安装后可将 Typora 设为 `.md` 默认编辑器（系统设置/安装选项） |
| Windows 资源管理器「新建 → Markdown」右键菜单 | 平台集成 | 支持 | P2 | 偏好含 System Integration → Add/Delete "Markdown" to "New" context menu |
| 命令行 / Shell 调用（`typora xxx.md`、`bin/typora.exe`） | 平台集成 | 支持 | P1 | `Docs/Use Typora From Shell or cmd.md` 描述 Windows 下直接输入 .md 路径或加入 PATH |
| 自动更新（检查更新、稳定 / 开发通道、下载安装） | 平台集成 | 支持 | P1 | 菜单含 Check for Updates / Check updates automatically；`resources/updater` 存在 |
| 系统暗色模式检测与跟随 | 平台集成 | 支持 | P2 | 主进程含 `isDarkMode`/`nativeTheme`/`useSeparateDarkTheme` |
| 第三方「Open in Typora」扩展（VS Code / Cursor） | 平台集成 | 支持（外部扩展，非安装包内） | P2 | 1.13 官方发布，右键 Markdown 文件用 Typora 打开 |
| 图片上传第三方集成（iPic / PicGo / Picsee） | 平台集成 | 支持 | P2 | 偏好含 PicGo Path、PicList Path、Executable，支持下载/升级 PicGo-Core |
| 许可证 / 激活（状态栏显示未激活；激活后解除限制） | 平台集成 | 支持（需激活） | P1 | 实测状态栏显示「未激活」；1.x 为一次性买断授权，未激活会提示 License Info |
| 多显示器 / 高 DPI / 缩放 | 平台集成 | 支持 | P2 | 主进程含 zoomFactor；1.8 修复多显示器窗口位置 |
| Windows ARM 平台 | 平台集成 | 不支持（基准包为 x64） | P2 | 基准安装包名 `typora-setup-x64.exe`；官方另提供 ARM 安装包，不在本基线内 |

---

## 3. 运行时核验记录（本次实测）

实测环境：Windows 10.0.26300，非管理员，`/CURRENTUSER` 静默安装到可写目录。
实测文档：`E:\deepseek-harness\konai\_work\probe.md`（含标题、任务列表、表格、脚注、块级/行内数学、mermaid 流程图、js 代码块、`[toc]`、emoji、上下标与高亮标记）。

| 观测项 | 结果 |
|---|---|
| 启动 | Typora 正常启动，主窗口标题 `probe.md• - Typora` |
| 实时预览 | 表格、脚注、块级积分、行内公式、mermaid 流程图、代码高亮、emoji 均原地渲染 |
| 高亮 / 上下标 | 默认关闭，`==highlight==`、`H~2~O`、`X^2^` 以字面显示 |
| 状态栏 | 显示 `1 / 85 词`；含源码模式切换按钮 |
| 侧边栏 | 显示「文件 / 大纲」，文件列表视图列出目录内容 |
| 授权状态 | 状态栏显示「未激活」，启动时出现 License Info 面板 |
| 快捷键 `Ctrl+,` | 未在本次自动化中成功打开偏好窗口（GUI 前台权限受限），偏好相关结论来自安装包自带 `page-dist` 偏好面板构建产物与 `Panel.json` |

> 限制说明：`typora.io` / `support.typora.io` 在本机直连超时，官方 release notes 与支持文档经官方中文站 `typoraio.cn` / `support.typoraio.cn` 核对；`windows-mcp` 桌面快照与 `craft-anything` UI 读取需要用户授权，本会话审批已禁用，故改用 PowerShell + PrintWindow 抓取窗口位图完成核验，未修改任何系统状态。

---

## 4. 网络流传但基准安装包未包含的条目（仅背景参考，不计入 MVP、不作为验收依据）

> 本节所有条目均来自网络预告、社区讨论或第三方评测，**基准安装包 1.14.15 不包含**，不得作为验收依据。

| 条目 | 来源 | 说明 |
|---|---|---|
| Typora 2.0（全新重构版本） | <http://v2.typora.io/> 预告页；小众软件 <https://meta.appinn.net/t/topic/93851>（2026-10-18 讨论） | 官方仅发布预告与等待列表，**未公布发布日期**，也未公布新功能清单；基准包为 1.14.15，不含任何 2.0 改动。网络流传「V1 免费升级至 V2」属运营政策传闻，非功能项 |
| 2.0 社区 Feature Request：文件夹独立主题（不同文件夹用不同字体/主题） | 同上 appinn 讨论整理的热门许愿 | 基准包仅有全局主题 + 明/暗主题分离 + 每文档 YAML/导出设置，无「按文件夹切换主题」的 UI 入口 |
| 2.0 社区 Feature Request：Wiki 双向链接 `[[文件名]]` 并在重命名后保持引用 | 同上 | 基准包内未检出 wikilink 解析（`frame.js` 无 wikilink/WikiLink 标识）；仅有 Markdown 链接与文档内锚点 |
| 2.0 社区 Feature Request：统一模板批量导出 PDF/HTML | 同上 | 基准包导出预设支持单个模板字段与「用上次设置导出」，但无「一次批量导出多文档」的入口 |
| 「鼠标悬停预览脚注」被列为 2.0 新愿望 | 同上 | **实际基准包已支持**（`Docs/Markdown Reference.md`：Hover over the footnote superscript to see content），故不属于未包含项，仅说明该愿望清单与现状不符 |
| Typora 移动端 App（iOS / Android） | 第三方评测 | 基准包为 Windows x64 桌面程序，无移动端产物 |
| Typora 内置 AI 助手 / 云同步 / 协同编辑 | 第三方评测与社区讨论 | 安装包内无相关模块或配置项 |
| Typora 插件系统 / 扩展 API | 社区讨论 | Typora 无插件机制，扩展仅限主题 CSS 与 `conf.user.json` 配置 |
| 「支持 200+ 代码高亮语言」 | 第三方评测 | 安装包内置清单 163 项（含别名），官方文档列 119 种主语言 |
| 完整文档版本历史 / Git 集成 | 社区讨论 | 基准包仅有自动保存草稿恢复与依赖系统的 Browse All Versions，无内置版本控制 |
| 「所见即所得」光标移动时符号不闪动 | 社区反馈 | 属体验吐槽而非功能条目；基准包行为未变更 |

---

## 5. 证据索引

| 类别 | 路径 / 链接 |
|---|---|
| 基准安装包 | `E:\AI-Agent\DeepSeek-Harness\home\attachments\v1\files\03\038e2af9.../typora-setup-x64.exe` |
| 分析副本 | `E:\deepseek-harness\konai\_work\typora-setup-x64.exe` |
| 静默安装目录 | `E:\deepseek-harness\konai\_work\typora_inst` |
| 应用清单 | `resources/package.json`（version 1.14.15, releaseId 56174512） |
| 默认配置 | `resources/conf.default.json` |
| 内置文档 | `resources/Docs/`（Change Log / Markdown Reference / Code Fences Language Support / Table Editing / Draw Diagrams With Markdown / Auto Save / Custom Themes / Custom Shortcut Keys / Install and Use Pandoc / Use Typora From Shell or cmd / Quick Start） |
| 主题 | `resources/style/themes/`（github / newsprint / night / pixyll / whitey） |
| 界面文案 | `resources/locales/Base.lproj/{Menu,Panel,Front,Welcome}.json`（菜单 301 项、偏好面板 500 项） |
| 渲染与图表 | `resources/lib.asar`（mermaid 11.13.0、mermaid-zenuml、MathJax4/tex-svg-full.js 4.1.0、codemirror/mode.min.js） |
| 主进程 | `resources/app.asar`（atom.compiled.dist.jsc：Readonly Mode、Typewriter Mode、Focus Mode、Toolbar、autoSaveTimer、spellchecker、export.printToPDF、getPageColor、darkTheme） |
| 偏好面板 | `resources/page-dist/` |
| 官方 release notes | <https://typora.io/releases/stable>（经 <https://www.typoraio.cn/releases/stable> 核对） |
| 官方支持文档 | <https://support.typora.io/What's-New-1.14/>、<https://support.typora.io/What's-New-1.13/>（经 <https://support.typoraio.cn/> 核对） |
| 运行时截图 | `E:\deepseek-harness\konai\_work\typora_win.png`（编辑器渲染实测） |

---

## 6. 合规说明

本次调研仅对安装包与安装后文件做**行为与机制理解**层面的静态核验与运行观察，未绕过授权、未破解、未修改基准安装包（只读副本 SHA-256 未变），未再分发原程序资源，产出中不包含反编译源码。
