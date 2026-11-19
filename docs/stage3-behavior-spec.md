# Konai 阶段 3 — Typora 1.14.15 行为规格说明书（REA 分析）

> 目标：为 Konai 重新实现提供**行为规格与约束**，不含可再分发的反编译源码。
> 基准：Typora 1.14.15（Windows x64 稳定版）
> 基准安装包 SHA-256：038e2af96968cbd55b7c418c9ad40b2cf45ffc8cc04dbc1cc98488f40e0a5c62（与附件文件名前缀一致，只读未修改）
> 静默安装目录：E:/deepseek-harness/konai/_work/typora_inst（仅行为理解，不复用任何资源）
> 证据强度标注：**静态证据**（文件/代码/字符串/REA 清单）、**官方文档**（安装包内 Docs）、**推断**（明确标注）。
> 说明：本阶段未运行基准程序做运行时实测；功能矩阵中的“实测”结论来自阶段 0/1。

---

## 1. 窗口结构与 IPC 边界

### 观察（Observed，静态证据）
- 安装目录分层：Typora.exe + resources/app.asar（仅 3 项：atom.compiled.dist.jsc、launch.dist.js、package.json）、resources/lib.asar（15 项第三方库）、resources/node_modules.asar（22 个顶层包）、resources/window.html、resources/appsrc/window/frame.js（1,714,248 字节渲染主包）、resources/page-dist/*（Welcome / Preferences / License / localSetting 四个 React 窗口）、resources/html/content.html、resources/html/preview.html。
- window.html 内联脚本：window.reqnode = window.require; delete window.require; delete window.exports; delete window.module;。全仓库检索 contextBridge = 0 处。
- frame.js 内定义 window.JSBridge（SystemJS 模块 "46"）：Node 路径用 ipcRenderer.invoke，mac 路径用 bridge.callHandler；JSBridge.sendIPC → ipcRenderer.send；JSBridge.putSetting → setting.put；JSBridge.menu.update → menu.updateMenu。
- 偏好面板 webview 显式设置 nodeintegration:true、contextIsolation:no、enableremotemodule:false。
- 主进程 IPC 句柄名（jsc 明文字符串）：setting.*、document.*、export.*、window.*、library.*、path.*、shell.*、dialog.*、theme.*、controller.*、clipboard.*、doc.syncChange、menu.updateMenu、updater.*、pandoc.*、license.*、registry.*。
- 渲染进程监听事件：willSave、didSave、willRename、didRename、saveFromUntitled、scheduleFullContentSync、updateQuickOpenCache、dict-loaded。

关键 IPC 通道用途（≥5 条）：
1. setting.put / setting.loadAll：写入/读取用户配置（主进程为配置真源）。
2. export.printToPDF：主进程对渲染好的临时 HTML 调 Chromium printToPDF 生成 PDF。
3. document.setContent / doc.syncChange：文档内容在渲染进程与主进程（持久化、快照）之间同步。
4. library.newFile/newFolder/renameFile/moveFile/trashItem：文件树所有写操作委托主进程。
5. theme.setThemeSource / theme.apply：系统/应用主题源与暗色状态切换。
6. controller.switchFolder / app.openFileOrFolder：打开文件夹/文件并切换挂载根。
7. menu.updateMenu：菜单勾选/可用性状态同步。
8. window.minimize/maximize/restore/close/fullscreen：窗口控制。

### 推断（Inferred）
- 无独立 preload 脚本；preload 边界 = 开启 nodeIntegration + 把 require 重命名为 reqnode + 渲染层 JSBridge 门面。主进程句柄注册在 jsc 字节码内，静态无法枚举全部，但渲染层实际调用的通道集合可枚举，可作为契约基线。
- 主窗口通过自定义协议加载：typora://app/typemark/window.html（jsc 字符串），协议 typora://、typora-bg:// 由主进程注册。

### 对 Konai 实现的启示（Implication）
- 采用 main / preload / renderer 三层；preload 用 contextBridge 暴露**白名单** API（优于 Typora 的全量 nodeIntegration，安全且等价）。
- IPC 通道按命名空间组织（setting/document/export/window/library/path/shell/dialog/theme/controller…），主进程负责窗口、菜单、对话框、文件、配置、打印、更新；渲染进程负责编辑与渲染。
- 把上表通道契约作为 Konai IPC 设计基线（可改名，但语义需覆盖）。

---

## 2. 文件树的实现方式

### 观察（Observed，静态证据）
- 文件监听在独立 Web Worker：resources/appsrc/finder-worker.js（10,000 字节明文）。
  - 输入命令：listAllFiles、quickFind、nodeInit、setSupportTextBundle、setDefaultExtension。
  - 输出消息：initFileCache、addInitFiles、removeInitFiles、queryMatch、queryEnd。
- **Windows**：fs.watch(folder, {persistent:false, recursive:true})；**忽略 change 事件**（只处理新增/删除/改名）；监听出错时回退到 chokidar 分支。
- **Linux/mac**：chokidar，interval:500（轮询）、depth:4、ignoreInitial:true、followSymlinks:false、ignorePermissionErrors:true。
- 过滤规则：隐藏文件（. 开头）、node_modules、.asar、大于 1 MB（stats.size/1000 > 1000）、扩展名白名单（md/markdown/mmd/mkd/mdwn/mdown/mdx/mdtxt/mdtext/apib/rmarkdown/rmd/qmd/txt/text 及空扩展名）。
- 上限：文件数 _MAX_COUNT=600、迭代 _MAX_ITER=4000，超限置 needBackEndQuery；快速查找 _MAX_QUERY_HIT=100。
- 事件去重：handledList + 100 ms 清空定时器。
- 文件夹固定与最近：setting.getRecentFiles 返回 {files:[{path}], folders:[{path, pinned}]}；setting.addRecentFolder、setting.updateRecentFile({path, pinned})、setting.removeRecentFolder、setting.removeRecentDocument；固定项在列表中前置（folders.filter(pinned).concat(unpinned)）。
- jsc 明文字符串含 recentFiles、recentFolders、pinned、pinRecentFolder、unpinRecentFolder、clearRecentDocuments、setRecentFolders。
- 运行时挂载根：File.setMountFolder / File.mountFolder_，editor.library.onRootChanged。

### 推断（Inferred）
- 最近/固定文件夹持久化在 <userData>/conf/conf.user.json 的 recentFiles / recentFolders 数组，元素形如 {n: 显示名, p: 绝对路径, pinned: bool}；userData 在 Windows 为 %APPDATA%/Typora（Electron 应用名 "Typora"，jsc 含 " - Typora" 与 abnerworks.Typora）。
- 监听策略是**平台混合**：Windows 事件驱动，类 Unix 轮询（500 ms），并非统一轮询或统一 inotify。

### 对 Konai 实现的启示（Implication）
- 文件树用 Worker 隔离监听；Windows 用递归 fs.watch，类 Unix 用 chokidar 轮询（500 ms、深度 4）。
- 强制扩展名白名单与隐藏文件/node_modules 过滤，并保留 600 文件 / 4000 迭代 / 100 命中的上限以匹配大目录体验。
- 最近/固定文件夹持久化到用户配置 JSON，固定项置顶；改名/移动后同步更新记录。

---

## 3. 所见即所得的渲染管线

### 观察（Observed，静态证据）
- frame.js 为 SystemJS 模块 bundle，关键模块：
  - MarkParser（模块 "18"）：块级解析，内置正则表覆盖 ul/ol/tasklist、标题（ATX 与 setext）、围栏、$$ 数学块、[toc]、脚注、引用链接、表格、分隔线等。
  - NodeDef（"11"）：Node / TYPE / NodeMap 文档模型。
  - Node2HTML（"13"）：Node.prototype.toHTML；行内走 parseInline / InlineLexer，聚焦段落走 brushContent。
  - Node2Mark（"10"）：Node.prototype.toMark（DOM→Markdown）。
  - Brush（"2a"）、Selection（"31"）、UndoManager（"1a"）。
- **两级解析**：块级（MarkParser）+ 行内（parseInline / InlineLexer / brushContent）。
- DOM 结构：#write 为 contenteditable；节点带 cid、mdtype、mdlike、按需 contenteditable；类名 .md-*；源模式为 #typora-source 的 CodeMirror（mode gfm）。
- 增量更新：simpleParse（单节点）、quickParse、quickRefresh(){ refresh(false, true) }、refreshUnder（mathBlock / fences / diagrams / htmlBlock / wordCount）、Editor.refresh（防抖 refreshTimeout）。
- 光标保持：selection.buildUndo() 生成 {startId, endId, startOffset, endOffset}；editor.lastCursor；undo.exeCommand 重放；focusAndRestorePos；toHTML 收集 cursorDiff；undo.register。
- 扩展渲染：MathJax 4（lib.asar/MathJax4/tex-svg-full.js，mathInline.renderAll / mathBlock）、Mermaid（lib.asar/diagram/*，diagrams.refreshDiagram / loadMermaidTheme）；导出/渲染前 fences.decorateAll()。

### 推断（Inferred）
- 管线：Markdown 文本 → MarkParser 块解析 → Node 树（含行内子节点）→ Node2HTML 序列化（行内 parseInline/brushContent）→ #write DOM；输入时按需 simpleParse/quickRefresh 局部替换，避免整文档重排。
- 光标跨刷新恢复依赖 **cid + 偏移快照**（块 id + 块内偏移），而非浏览器原生 selection；这是所见即所得“输入即渲染且光标不跳”的核心机制。
- 性能手段：防抖刷新、块级懒渲染（brush 队列）、超大文档 oversize 模式（document.enterOversize）。

### 对 Konai 实现的启示（Implication）
- 采用**块级 + 行内两级解析**与 **cid 锚定的增量 DOM 更新**；刷新前后用 cid+offset 快照恢复光标。这是 P0“实时预览”的硬约束。
- 解析器可用公开实现（如 markdown-it/自研），但必须自建“Markdown ↔ 带 cid 的 DOM 节点”双向映射与局部刷新，否则无法达标。
- 源模式与所见即所得共享同一文档模型/文本，切换视图不丢状态。

---

## 4. 导出 PDF / HTML 的底层路径

### 观察（Observed，静态证据）
- PDF：File.editor.export.exportPDF = exportToHTML({forPrint:true}) → 写临时 HTML 到 File.option.tempPath → JSBridge.invoke("export.printToPDF", path, {taskLabel, printBackground:true, margins, pageSize}) → 主进程返回 PDF 字节 → PDFLib.PDFDocument.load → 写书签（pdf.getFixData / getHeaderMatrix）与页眉页脚 → 保存。
- 打印：export.genPrintView（隐藏打印窗口）→ export.print（jsc 字符串含 window.print()、no valid printers available）。
- 图片导出：Worker image-worker.js + export.prepareImageCapture（返回 winId/总高）→ export.captureImage（按页高分块捕获）→ 拼接。
- exportToHTML 的 CSS/资源注入：
  - 收集 <link css-include>；
  - 主题链：theme_css（当前主题）→ base_user_css（base.user.css）→ theme_user_css（{theme}.user.css）；若指定 exportTheme 则用 [exportTheme+".css", "base.user.css", exportTheme+".user.css"]；
  - 递归解析 CSS 内 @import 与 url()，剥离 @font-face，把匹配的 document.styleSheets（base.css/theme/codemirror/mermaid）内联为 <style>；
  - 支持 @include-when-export 指令；forImage 隐藏滚动条；forPrint 加 typora-print；**暗色且未指定导出主题时回退 github 浅色主题**；
  - h.exportTheme 支撑“Copy without Theme Styling”。
- pdf-lib / pdf-designer 在 window.html 底部加载，PDF 后处理在渲染进程内完成。
- 官方文档：HTML 导出不需要 Pandoc；Pandoc 用于其他格式（pandoc.import）。

### 推断（Inferred）
- PDF 走 **Chromium/Electron 的系统级打印管线**（printToPDF），不是独立渲染引擎；pdf-lib 仅做书签/页眉页脚等后处理。
- HTML 导出 = 渲染进程 DOM→HTML + 主题 CSS 递归内联，图片/字体解析为本地绝对路径。
- 主题在导出时按“当前主题链”注入，与屏幕渲染同一套 CSS 变量与用户覆盖。

### 对 Konai 实现的启示（Implication）
- PDF：webContents.printToPDF（或隐藏打印窗口）+ pdf-lib 后处理书签/页眉页脚。
- HTML：复用同一 DOM→HTML 与 CSS 内联管线，保证主题、字体、图片路径在导出时解析为本地绝对路径。
- 暗色模式导出需显式主题回退策略（默认浅色），避免黑底黑字。

---

## 5. 设置系统

### 观察（Observed，静态证据 / 官方文档）
- 默认配置：resources/conf.default.json（含 defaultFontFamily、autoHideMenuBar、searchService、keyBinding、monocolorEmoji、maxFetchCountOnFileList、flags）。
- 用户配置：jsc 字符串 /conf/conf.user.json、/conf/conf.default.json、[warn] cannot parse user config, use the default one、initUserConfig_；Preferences 面板“打开高级设置”打开 userDataPath()/conf。
- 读写：JSBridge.putSetting(key,value) → setting.put；JSBridge.loadOptions() → setting.loadAll；渲染层选项在 File.option.*；mac 用 window._options。
- 多窗口传播：Preferences 通过 execForAll / syncToPreference（g.send("syncToPreference", code)，主窗口 window.eval）同步各窗口；面板用 setting.getExtraOption + reloadData() 重取。
- 官方文档：autoSaveTimer（分钟）等写在 conf.user.json；1.13 起“修改 Markdown 设置不再需要重启（提供重载按钮）”。

### 推断（Inferred）
- 持久化格式为 JSON，主进程合并 default + user 并写盘；**热重载不依赖文件监听**，而是主进程主动向各 renderer 注入 JS（execForAll / syncToPreference）并让面板重取 getExtraOption。
- 配置文件被外部修改后，需重启或显式重载才整体生效（推断）。

### 对 Konai 实现的启示（Implication）
- 采用 conf.default.json + conf.user.json 覆盖合并，单一真源在主进程。
- 设置改动通过 IPC 广播到所有窗口**立即生效**（不要轮询文件），并提供“打开 conf 目录”入口。
- 自动保存间隔等高级项写 conf.user.json，与官方文档一致。

---

## 6. 主题系统

### 观察（Observed，静态证据）
- CSS 变量体系：base.css :root{--bg-color:#ffffff;--text-color:#333333;--select-text-bg-color;--select-text-font-color;--monospace;--title-bar-height}；window.css 增补 --side-bar-bg-color、--window-border-color、--sidebar-width；主题 css 覆盖（night.css 一组暗色变量，github.css / newsprint.css / pixyll.css / whitey.css 等）。
- 加载顺序（window.html link）：base.css → base-control.css → codemirror.css → window.css → megamenu.css → typora-bg://bg.css(#bg_css) → typora://app/userData/themes/current-theme.css(#theme_css) → #base_user_css → #theme_user_css。
- File.setTheme：把 #theme_css 指向 typora://app/userData/themes/<theme>.css，#base_user_css=base.user.css，#theme_user_css=<theme>.user.css；删除 #bg_css；读取 body 背景计算 File.colorBrightness=(299r+587g+114b)/256000；写 backgroundColor / isDarkMode；调用 theme.setThemeSource("dark"|"system")。
- 暗色信号（jsc 字符串）：nativeTheme、shouldUseDarkColors、themeSource、useDarkThemeBefore、useSeparateDarkTheme、theme.apply、theme.setThemeSource、darkTheme。
- 路径解析：current-theme.css 被重写为实际主题文件名；typora://app/userData 映射到 _options.userDataPath；typemark / wkfile: 统一解析为本地路径。
- 主题预览：Preferences 用 resources/html/preview.html?folder=...&css=...（该页读取 folder/css 参数设置 #theme_css）。
- 官方文档：自定义主题放主题目录；base.user.css 应用于所有主题，{theme}.user.css 仅应用于该主题。

### 推断（Inferred）
- 亮/暗切换信号流：主进程监听系统 nativeTheme / shouldUseDarkColors → theme.setThemeSource；渲染进程据 File.colorBrightness<0.5 判定暗色并写 isDarkMode；支持“单独暗色主题”。
- 主题切换 = 更换 CSS 链接（触发重载）+ 重算背景亮度 + 同步窗口/菜单/状态栏。
- 用户 CSS 优先级：base.user.css 先于 {theme}.user.css，后者覆盖前者；主题 css 覆盖 base 变量。

### 对 Konai 实现的启示（Implication）
- 用 CSS 变量体系组织主题，按 base.css → 主题 css → base.user.css → {theme}.user.css 顺序加载。
- 切换主题即换 link + 重算背景亮度，并同步 isDarkMode 与系统主题源；导出复用同一主题链。
- 提供主题目录与两级用户覆盖，保证升级不丢用户样式。

---

## 7. 安全机制：jsc 字节码保护范围

### 观察（Observed，静态证据 + REA 清单）
- REA 清单（evidence ev_835d128c0485d5abde98e0ec51c109475f19453967335f86a16946c1246b49cd，inventory ev_7f82435250caf46c290d361fb69f821bea013f3d85677769152ead66a732ea7a）：app.asar 仅 4 节点 / 3 边，成员为 atom.compiled.dist.jsc (388,400 B，sha256 9e38aef22aff76842566fe4b0f91e271565f4051d36943faecbc97969e4f5660)、launch.dist.js (1,383 B，sha256 3ec9df885d96feaa030b2e34f02007a1b0659971624f043726ce12ce8d97b81b)、package.json (252 B)。
- launch.dist.js：注册 .jsc / .cjsc 扩展；v8.setFlagsFromString("--no-lazy")、"--no-flush-bytecode"；用 vm.Script(code,{cachedData}) 执行并校验缓存头（12–16 字节 flag/hash），失败抛 Invalid or incompatible cached data。即 **V8/JSC 字节码缓存**，非自定义加密。
- 全仓库 .jsc 仅此一个（安装目录与解包目录检索）。
- 明文模块：lib.asar 全部 JS（CodeMirror / Mermaid / MathJax4 / pdf-lib / pdf-designer / jimp / aws-sdk）、node_modules.asar 22 个顶层包（adm-zip、chokidar、cld、electron-dl、electron-fetch、electron-progressbar、extract-zip、fs-extra、fs-plus、fswin、getos、graceful-fs、hjson、iconv-lite、jschardet、lowdb、native-reg、node-machine-id、raven、spellchecker、sudo-prompt、vscode-ripgrep）及原生 .node、appsrc/*.js（frame.js 1.71 MB）、page-dist/*.js、window.html、html/*、style/*、Docs、locales。
- 主进程句柄名以明文字符串存在于 jsc（可 strings 提取），但逻辑不可读。

### 推断（Inferred）
- 保护范围仅**主进程业务逻辑**（窗口/菜单/IPC/文件/导出/设置/更新/协议）；渲染层与第三方库全明文。
- 因此 IPC 通道契约可从渲染层明文与 jsc 字符串复原；主进程内部实现（打印窗口调度、快照/自动保存、文件监听后端细节）只能黑盒复刻。
- .jsc 是 V8 字节码缓存，可用匹配的 V8/Node 直接执行（加载器即证明），无需“解密”；但源码级逻辑不可得。

### 对 Konai 实现的启示（Implication）
- 可借鉴（有明文/字符串证据）：渲染管线、IPC 通道命名与语义、文件树/设置/主题/导出行为契约。
- 只能黑盒复刻：主进程内部逻辑。**不得反编译再分发、不得绕过授权或复用基准资源**。

---

## 约束清单（交给构建 Agent）

1. 采用 main/preload/renderer 三层结构，preload 用 contextBridge 暴露白名单 API，禁止全量 nodeIntegration。（对应问题 1）
2. 实现块级 + 行内两级 Markdown 解析，以及 cid 锚定的增量 DOM 渲染；每次刷新前后用 cid+offset 快照恢复光标。（P0 实时预览）
3. 文件树用平台混合监听（Windows 递归 fs.watch / 类 Unix chokidar 500 ms 轮询），强制执行扩展名白名单、隐藏文件与 node_modules 过滤、600 文件 / 4000 迭代上限与快速查找 100 命中上限。（P0 文件树 / 快速打开）
4. 把最近与固定文件夹以 {n, p, pinned} 持久化在 <userData>/conf/conf.user.json，固定项在列表中置顶。（P1 最近位置）
5. PDF 导出走 Chromium printToPDF 并用 pdf-lib 后置处理书签与页眉页脚；HTML 导出走 DOM→HTML + 主题 CSS 递归内联。（P0 导出 PDF / HTML）
6. 设置用 conf.default.json + conf.user.json 覆盖合并、主进程为真源，改动经 IPC 广播到所有窗口立即生效，并提供“打开 conf 目录”入口。（P0/P1 设置）
7. 主题用 CSS 变量体系，按 base.css → 主题 css → base.user.css → {theme}.user.css 顺序加载；切换主题即换 link、重算背景亮度并同步 isDarkMode 与系统主题源。（P1 主题 / 暗色）
8. 导出与打印前把 typora: / wkfile: / @import / url() 统一解析为本地绝对路径并内联字体与 CSS；暗色且未指定主题时回退浅色主题。（P0 导出）
9. 只复刻行为契约，不复制、再分发或修改基准资源；主进程逻辑以黑盒方式复刻。（合规红线）

---

## 附录 A：证据索引

| 类型 | 位置 / ID |
|------|-----------|
| 安装包 | E:/AI-Agent/DeepSeek-Harness/home/attachments/v1/files/03/038e2af96968cbd55b7c418c9ad40b2cf45ffc8cc04dbc1cc98488f40e0a5c62/typora-setup-x64.exe，SHA-256 038e2af96968cbd55b7c418c9ad40b2cf45ffc8cc04dbc1cc98488f40e0a5c62（113,644,008 B） |
| 安装目录 | E:/deepseek-harness/konai/_work/typora_inst |
| 渲染主包 | resources/appsrc/window/frame.js（1,714,248 B，sha256 23d100ee1f4a1340b7db418a5995b792b45f2d8fe953a8a731883aa9beff2ec8） |
| 窗口壳 | resources/window.html（91,770 B） |
| 文件监听 Worker | resources/appsrc/finder-worker.js（10,000 B） |
| 主进程字节码 | resources/app.asar → atom.compiled.dist.jsc（388,400 B，sha256 999dd83c4df4542790e9a73b5058c1b5bd429dfa847619c55e7ca1e5e350827d）；launch.dist.js（1,383 B） |
| 第三方库 | resources/lib.asar（8,342,504 B）；resources/node_modules.asar（9,970,596 B，3187 个条目） |
| 主题 | resources/style/base.css、window.css、themes/{github,night,newsprint,pixyll,whitey}.css；resources/html/preview.html |
| 配置 | resources/conf.default.json；jsc 字符串 /conf/conf.user.json |
| 文档 | resources/Docs/{Custom Themes,Auto Save…,Use Typora From Shell or cmd,Install and Use Pandoc}.md |
| REA | 检查 ev_835d128c0485d5abde98e0ec51c109475f19453967335f86a16946c1246b49cd；app.asar inventory ev_7f82435250caf46c290d361fb69f821bea013f3d85677769152ead66a732ea7a；appsrc JS 图 ev_3bdbf1efe757510ecd3adfeba0dfbd0da4e097b934dd79b170ce2dbc4c267647（视图 ev_d3da6f52b768cfe806f6c2c7798889acb071fb09db66199d9961b3a2b9e7fc22，3 文件 / 503,861 AST 节点 / 1185 findings） |

## 附录 B：限制说明

- 本会话审批提示被禁用，需要授权的工具调用会被自动拒绝；本次未执行任何改变设备或基准包的操作，安装包保持只读且 SHA-256 未变。
- 本阶段为**静态分析 + REA**，未运行基准程序做运行时实测（矩阵中的“实测”来自阶段 0/1）。
- 主进程为 V8 字节码，无法静态枚举全部 ipcMain 句柄与内部实现；通道清单来自渲染层明文调用 + jsc 明文字符串。
- REA analyze_javascript_application 对 lib.asar 请求超时；对 resources/appsrc 成功但 frame.js 语义分析触发 worker 堆上限（覆盖为部分），结论以明文阅读为准。
- 未建立 craft-anything 项目调查记忆（会话无已打开项目上下文，其 core 工具未成功调用）；本文件即为阶段 3 的交付记忆。
