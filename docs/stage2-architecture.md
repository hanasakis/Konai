# Konai 阶段 2 — 技术架构方案（施工蓝图）

> 角色：架构规划 Agent　|　输入基线：阶段 0/1 功能矩阵（Typora 1.14.15 Windows x64，113 条）　|　产出：构建 Agent 可直接施工的蓝图
> 生成时间：2026-11-18（Asia/Shanghai）
> 硬性约束：Windows 桌面应用、UI 与基准运行界面高度相似、完全免费无激活、净室构建（不复用基准包任何图标/主题/字体/jsc/反编译产物）、离线依赖可得、许可证合规（禁 Copyleft 传染分发物）。

---

## 0. 结论摘要（TL;DR）

| 项 | 结论 |
|---|---|
| **推荐技术栈** | **Electron + TypeScript + Vite + CodeMirror 6 + MathJax 4 + Mermaid 11 + electron-builder/Inno Setup**（宿主选 Electron；编辑器内核选 CodeMirror 6 + `@lezer/markdown` 增量树；导出用 Chromium `printToPDF` + `pdf-lib` 后处理） |
| 候选栈 | 3 个：① Electron+CodeMirror（推荐）② Tauri 2+CodeMirror ③ WinUI 3+WebView2+TS（详见 §1） |
| **模块数** | **8 个**：应用外壳 / 编辑器内核 / 文件系统层 / 渲染桥接 / 导出引擎 / 主题系统 / 搜索与导航 / 配置与持久化（详见 §2） |
| **里程碑数** | **5 个**（MS1→MS5，P0→P1→P2，每个含演示内容 + 矩阵条目 + 验收方式，详见 §6） |
| **风险数** | **8 个**（光标漂移、Mermaid/MathJax 生命周期、PDF 字体嵌入、Pandoc Copyleft、Electron 体积/ffmpeg、净室合规、Markdown 保真度、离线构建依赖，详见 §7） |
| 交付物 | 本文件 `konai/docs/stage2-architecture.md`；配套 `stage2-architecture.spec.json`（机读验收映射，见 §8.4） |
| 关键取舍 | 源文本即事实来源（Markdown 单一真源）；块级"硬渲染 + 覆盖层编辑"；数学用 MathJax 4 保真、Mermaid 懒加载；PDF 用 Chromium 打印 + pdf-lib 书签；不打包 Pandoc（docx 用 npm `docx` 自写） |

---

## 1. 技术选型

### 1.1 评估维度与权重

| 编号 | 维度 | 权重 | 说明 |
|---|---|---|---|
| W1 | 所见即所得块级/行内实时渲染可行性 | 25% | P0 核心，决定产品成立与否 |
| W2 | 文件树、多标签/多窗口、原生菜单与快捷键 | 20% | P0/P1 组织能力与 Typora 老用户肌肉记忆 |
| W3 | 打包体积与启动速度 | 15% | 安装包体积、冷启动、大文档打开时延 |
| W4 | Markdown / 数学 / Mermaid 生态成熟度 | 20% | 113 条中约 30 条依赖该生态 |
| W5 | 跨平台可维护性 | 10% | 代码复用率、单一技术栈、CI 成本 |
| W6 | 离线依赖可得性与许可证合规 | 10% | 构建机网络、许可证禁 Copyleft |

### 1.2 候选栈对比

评分 1–5（5 最优），加权分 = Σ(权重 × 评分)。

| 维度(权重) | A. Electron + CodeMirror 6 | B. Tauri 2 + CodeMirror 6 | C. WinUI 3 + WebView2 + TS |
|---|---|---|---|
| W1 WYSIWYG(25%) | 5 | 5 | 4 |
| W2 文件树/多标签/多窗口/菜单(20%) | 5 | 4 | 5 |
| W3 体积与启动(15%) | 3 | 5 | 4 |
| W4 生态(20%) | 5 | 4 | 3 |
| W5 跨平台(10%) | 5 | 4 | 2 |
| W6 离线与许可(10%) | 4 | 4 | 3 |
| **加权总分** | **4.60** | **4.40** | **3.70** |
| 安装包体积 | ~90–130 MB（含 Chromium） | ~6–15 MB | ~5–20 MB |
| 冷启动 | 1.5–2.5 s（可优化） | <1 s | <1 s |
| 关键技术债 | 体积；ffmpeg 组件许可 | PDF 导出（页边距/页眉页脚/书签/背景）能力弱于 Chromium 打印；Rust 工具链；多窗口/打印 API 年轻 | 仅 Windows；WebView2 运行时依赖；与 TS 双向桥接复杂；生态需自绘 |

**方案 B（Tauri 2）**：Rust 宿主 + WebView2。体积与启动最优，但 **P0 的 PDF 导出**（页边距、页眉页脚、页面分隔、暗色背景、书签/大纲）在 WebView2 打印路径上能力弱、可控性差；`@tauri-apps` 的多窗口与打印插件成熟度低于 Electron；Rust 工具链增加构建复杂度。**保留为"体积敏感"备选**：本方案的编辑器内核与渲染层与宿主解耦（§3 接口边界），若未来要求安装包 < 30 MB，可迁移宿主而不重写编辑器。

**方案 C（WinUI 3 + WebView2）**：原生外壳最好，但直接违反 W5 跨平台可维护性，且 Markdown 生态（CodeMirror 的浏览器假设、Chromium 打印）在 WebView2 中收益有限、桥接成本高。**不推荐**。

### 1.3 推荐结论与理由

**推荐 A：Electron + TypeScript + Vite + CodeMirror 6。**

1. **PDF 导出是 P0，Electron 独占优势**：Chromium `webContents.printToPDF` 原生支持 `margins` / `pageSize` / `headerTemplate` / `footerTemplate` / `printBackground`（对应 EX-01 页边距、纸张、页眉页脚；EX-02 暗色背景），配合 `pdf-lib` 写书签/大纲（EX-01、EX-14），是三条候选路径中唯一能高保真覆盖 P0 导出矩阵的。
2. **WYSIWYG 内核与 Typora 的"源文本单一真源"同构**：CodeMirror 6 的增量语法树（`@lezer/markdown`）+ 装饰系统可在**不改动源文本**的前提下隐藏语法标记、嵌入渲染 widget，从架构上规避"整页重渲染导致的光标漂移"（详见 §5）。
3. **生态最完整**：`@codemirror/lang-markdown`、`@codemirror/legacy-modes`（100+ 语言模式，覆盖矩阵"119 种主语言"要求）、`@codemirror/search`（EC-35）、`@codemirror/autocomplete`（ER-15）、MathJax 4（ER-01/02/03）、Mermaid 11（ER-04/05）、`pdf-lib`、`chokidar`、`vscode-ripgrep`（FO-09）。
4. **原生能力成本最低**：`Menu` / `globalShortcut` / `BrowserWindow` / `protocol` / `shell.trashItem`（FO-06 删除入回收站）/ `desktopCapturer` 等 API 与矩阵条目一一对应。
5. **体积/启动可控**：Vite 按需分包 + 懒加载 MathJax/Mermaid + asar + 移除未用 ffmpeg 组件，可把安装包控制在 ~90 MB、冷启动 < 2.5 s（预算见 §7 R5）。

### 1.4 关键技术决策（决策记录）

| 决策 | 选择 | 理由与替代 |
|---|---|---|
| 编辑器内核 | CodeMirror 6 + `@lezer/markdown` 增量树 + 自定义装饰/块模型 | 替代 ProseMirror/Tiptap：后者以"渲染后的文档"为模型，对任意 Markdown（裸 HTML、front matter、复杂表格）保真度差、序列化有损；CM6 保留源文本，序列化零损耗 |
| 数学渲染 | **MathJax 4**（Apache-2.0，懒加载） | 对齐基准渲染观感与宏包能力（ams/physics/xypic/textmacros，ER-02）；KaTeX（MIT）仅作可选快速路径，不默认启用 |
| 图表渲染 | Mermaid 11（MIT，懒加载）+ 自研 sequence/flow/zenuml 适配 | ER-04/05/06/07；Mermaid 依赖 D3，按需加载避免首屏膨胀 |
| 代码高亮 | CodeMirror 语法高亮（`@codemirror/lang-*` + `@codemirror/legacy-modes`） | 与编辑器同源，避免 Shiki 双份 token 成本；语言清单对齐矩阵 ER-08 |
| HTML 导出 | 自研渲染器（复用渲染管线 → 独立 HTML + 内联主题 CSS） | EX-03/04；数学可选 SVG 或 LaTeX 源码 |
| PDF 导出 | Chromium `printToPDF` + `pdf-lib` 后处理 | EX-01/02/11/14；见 §4.5 与 §7 R3 |
| docx 导出 | npm `docx`（MIT）内置写入器 | EX-05；**不打包 Pandoc**（GPL-2.0+），避免 Copyleft 进入分发物（§7 R4） |
| 打包 | electron-builder 产出 `win-unpacked` + **Inno Setup 6** 封装 | 对齐基准静默安装验收参数 `/VERYSILENT /CURRENTUSER /DIR=...`（PI-01） |
| 包管理 | **npm workspaces**（npm 11 实测可用） | 实测本机 pnpm 版本异常（`pnpm -v` 回显 Node 版本），npm workspaces 零额外工具链风险；pnpm 可作可选替代 |
| 构建镜像源 | `ELECTRON_MIRROR` / `ELECTRON_BUILDER_BINARIES_MIRROR` 指向 npmmirror | 实测 `github.com/electron/electron/releases` 超时，`registry.npmmirror.com` 返回 200（§7 R8） |

---

## 2. 模块划分（8 个）

模块间通过**显式接口 + IPC 契约**通信，禁止跨模块直接 import 实现细节。模块编号 M1–M8，与目录、验收条目一一对应。

### M1 应用外壳（App Shell）

- **职责**：主进程生命周期；窗口管理（多窗口/多标签/会话恢复）；菜单栏与命令注册表；全局快捷键；系统托盘；文件关联与协议处理（`konai://`、`.md` 默认打开）；自动更新；原生对话框；打印。
- **关键能力映射**：FO-17 多标签/多窗口、EC-29 快捷键自定义、PI-01/02/03/04/05/06/10、WX-13/14、EX-11 打印。
- **边界**：不解析 Markdown、不直接操作 DOM；只通过 IPC 调用 M3/M5/M7。
- **核心抽象**：`CommandRegistry`（命令 = id + 标题 + 键位 + 菜单路径 + 动作），菜单栏/右键菜单/快捷打开/偏好面板均从它生成。

### M2 编辑器内核（Editor Kernel）

- **职责**：Markdown 增量解析、块模型（Block Model）、WYSIWYG 装饰与 widget 渲染、光标/选区映射、撤销/重做、查找替换、源码模式切换、输入辅助（自动配对/智能标点/Emoji）、行内数学与行内样式的实时渲染。
- **关键能力映射**：EC-01~EC-10、EC-17、EC-23、EC-24、EC-29、EC-30、EC-33、EC-35、EC-36；ER-01（行内）、ER-08（代码高亮）、ER-15。
- **边界**：纯 TypeScript + DOM，**不依赖 Electron/Node**，可在 Node 中单元测试；渲染 widget 内容通过 M4 的 `RenderBridge` 接口注入。
- **子模块**：`parser/`（增量树→块）、`model/`（文档状态）、`render/`（装饰与 widget）、`cursor/`（映射与吸附）、`history/`（三层撤销）、`input/`（配对/标点/Emoji）、`search/`（查找替换）、`source-mode/`。

### M3 文件系统层（FS Layer）

- **职责**：工作区（文件夹）管理；文件树/文件列表数据模型与排序/过滤/分组；文件 CRUD（新建/重命名/移动/删除入回收站，可撤销）；最近文件与最近位置（固定/取消/清除）；文件监听与外部修改检测/重载；自动保存与草稿恢复；文件包（TextBundle/TextPack）读写。
- **关键能力映射**：FO-01~FO-19 中除 FO-08/09（归 M7）外的全部；WX-09、WX-10。
- **边界**：仅主进程（Node）可达；所有写操作走 `Command`（可撤销）；对渲染进程只暴露只读快照 + 事件。
- **安全**：路径规范化与越界防护（禁止访问工作区外未显式授权的路径）；删除优先 `shell.trashItem`，失败回退"回收站目录 + 撤销元数据"。

### M4 渲染桥接（Render Bridge）

- **职责**：数学（MathJax 4）、Mermaid/sequence/flow/zenuml 图表、代码块高亮、图片/视频/音频/iframe 媒体、行内 HTML 的安全渲染与沙箱；主题切换时的重渲染；渲染任务的排队/取消/懒加载。
- **关键能力映射**：ER-01~ER-14；EC-17/18/19 的块级部分。
- **边界**：渲染进程内运行；对 M2 暴露 `RenderBridge` 接口（§3.3），对 M1 暴露"导出用静态渲染"接口。
- **强约束**：禁用 `eval`；CSP `script-src 'self'`；`iframe` 沙箱 `sandbox="allow-scripts allow-same-origin"` 并白名单域名（对齐基准 1.14.15 的 iframe 沙箱修复）。

### M5 导出引擎（Export Engine）

- **职责**：HTML（含样式/无样式）、PDF（边距/纸张/页眉页脚/页面分隔/暗色背景/书签/大纲）、docx（内置写入器）、odt/rtf/epub/latex/mediawiki（可选 Pandoc 外部调用）、导入（同前，可选 Pandoc）、导出为图片（文档/选区/图表/公式）、导出预设与变量替换、导出后动作、Pandoc 检测/版本校验/安装引导、打印。
- **关键能力映射**：EX-01~EX-14。
- **边界**：主进程侧（Chromium 打印、文件系统）+ 渲染进程侧（HTML 组装）；通过 `ExportRequest` 契约调用；Pandoc 仅为**可选外部程序**，不打包、不链接、不分发。
- **合规**：导出产物不得包含任何授权/水印/标识。

### M6 主题系统（Theme Engine）

- **职责**：主题注册表（默认 + 至少 github/newsprint/night/pixyll/whitey 风格的**原创**主题）；CSS 变量体系（字体/字号/颜色/间距/内容宽度）；明/暗主题分离与系统暗色跟随；用户自定义 CSS（`base.user.css`、`{theme}.user.css`）；导出与打印的主题注入；代码块与 Mermaid 的暗色适配。
- **关键能力映射**：WX-05、WX-06、WX-07、WX-08；EX-02（暗色背景导出）。
- **边界**：主题 = 数据（JSON 元信息 + CSS 文本），不含二进制图片；主题 CSS 与编辑器/导出共用同一套变量（单一来源）。
- **净室**：**禁止**复制基准包 `resources/style/themes/*.css`；主题以"极简、留白、细分割线、无衬线"为风格导向原创实现。

### M7 搜索与导航（Search & Navigation）

- **职责**：Quick Open（Ctrl+P 模糊匹配文件名/路径，大文件夹优化）；全局搜索（跨文件内容、正则、文件名校验，ripgrep 封装）；大纲面板（可折叠/平面、过滤、点击跳转、当前标题高亮、全部展开/折叠）；`[toc]` 目录生成与更新；文章列表视图。
- **关键能力映射**：FO-02、FO-03、FO-04、FO-08、FO-09、FO-11；EC-15。
- **边界**：搜索在主进程（ripgrep 子进程/库）执行，结果以流式事件推送到渲染进程；渲染进程只保存 UI 状态。
- **性能**：1.14.15 的 Quick Open 改进方向 = 增量索引 + 前缀/模糊混合评分 + 结果上限 + 取消令牌。

### M8 配置与持久化（Config & Persistence）

- **职责**：配置 schema 与默认值（对齐基准 `conf.default.json` 的键位/偏好语义）、`conf.user.json` 覆盖与校验（zod）、键位绑定覆盖、窗口状态/会话持久化、草稿与自动保存元数据、最近文件/位置存储、本地化文案（i18n）、设置面板数据源。
- **关键能力映射**：EC-29、WX-07（Open Theme Folder）、WX-09/10、WX-13/14/15、PI-02/03；以及所有偏好项的落盘。
- **边界**：配置为**纯数据**，不含逻辑；渲染进程与主进程通过只读快照 + 变更事件共享；写盘原子化（临时文件 + rename）。
- **合规映射**：PI-09（许可证/激活）**不实现** —— 验收标准改为"零激活提示、零试用限制、全功能默认可用、无遥测上报"。

**模块依赖（允许方向）**

```text
M1 应用外壳 ──▶ M3 FS ──▶ M8 Config
   │  └────▶ M5 Export ──▶ M4 RenderBridge(静态渲染模式)
   └──▶ M7 Search
M2 EditorKernel ──▶ M4 RenderBridge
   └──────────▶ M8 Config(只读)
渲染进程: M2 + M4 + M6 + M7(UI) + M8(只读)
主进程:   M1 + M3 + M5 + M7(引擎) + M8
```


### 3.1 仓库结构（npm workspaces 单仓）

```text
konai/
├─ package.json                     # workspaces: apps/*, packages/*；脚本见 §8.2
├─ tsconfig.base.json
├─ .npmrc                           # registry、electron mirror、save-exact
├─ docs/
│  ├─ stage0-1-feature-matrix.md     # 基线（输入）
│  ├─ stage2-architecture.md        # 本文件
│  └─ stage2-architecture.spec.json# 机读验收映射（§8.4）
├─ cleanroom/                       # 净室合规
│  ├─ ASSET_PROVENANCE.md           # 每个视觉资源的来源/作者/许可证
│  ├─ typora-file-hashes.txt        # 基准安装目录文件哈希黑名单（仅哈希+相对路径）
│  └─ FORBIDDEN_PATTERNS.txt        # 禁止出现的字符串/资源名（Typora 品牌、文件名）
├─ apps/
│  └─ desktop/
│     ├─ package.json               # @konai/desktop
│     ├─ electron.vite.config.ts
│     ├─ electron-builder.yml       # 产出 win-unpacked + 资源
│     ├─ iss/setup.iss              # Inno Setup 6 脚本（对齐 /VERYSILENT /CURRENTUSER /DIR=）
│     ├─ build/                     # 原创图标源（SVG）与导出脚本产物
│     │  ├─ icon.svg / icon-16..256.png / icon.ico / uninstaller.ico
│     │  └─ installer-header.bmp    # 原创
│     └─ src/
│        ├─ main/                   # 主进程（M1/M3/M5/M7 引擎/M8）
│        │  ├─ index.ts  app-shell.ts  window-manager.ts  protocol.ts
│        │  ├─ menu/    menu-builder.ts  menu-registry.ts  commands/
│        │  ├─ ipc/    router.ts  validators.ts  handlers/{fs,export,search,config,update}.ts
│        │  ├─ fs/     workspace.ts  file-ops.ts  watcher.ts  trash.ts  autosave.ts  drafts.ts
│        │  ├─ export/ pdf.ts  html.ts  docx.ts  pandoc.ts  image.ts  presets.ts  print.ts
│        │  ├─ search/ ripgrep.ts  quick-open.ts  outline.ts
│        │  ├─ config/ store.ts  schema.ts  migrations.ts  i18n.ts
│        │  └─ update/ updater.ts
│        ├─ preload/
│        │  ├─ index.ts              # contextBridge.exposeInMainWorld('konai', api)
│        │  └─ api.d.ts              # 渲染进程唯一入口类型
│        └─ renderer/
│           ├─ index.html
│           └─ src/
│              ├─ main.tsx  app/{App.tsx, layout.tsx, commands.tsx}
│              ├─ editor/  {EditorPane.tsx, WysiwygController.ts, BlockWidgets.tsx,
│              │            OverlayEditor.tsx, cursor.ts, history.ts, find.ts}
│              ├─ sidebar/ {Sidebar.tsx, FileTree.tsx, FileList.tsx, Outline.tsx}
│              ├─ statusbar/{StatusBar.tsx, WordCount.tsx}
│              ├─ preferences/{PreferencesWindow.tsx, panes/*.tsx}
│              ├─ export/{ExportPanel.tsx, ExportSettings.tsx}
│              ├─ quickopen/{QuickOpen.tsx, GlobalSearch.tsx}
│              ├─ theme/{theme-loader.ts, variables.css, base.css}
│              └─ styles/  (原创)
├─ packages/
│  ├─ editor-kernel/    # M2 纯 TS（无 DOM/Electron 依赖，可 node 测试）
│  │  ├─ src/{parser,model,render,cursor,history,input,search,source-mode}.ts
│  │  └─ test/           # 光标映射/撤销/增量解析黄金用例
│  ├─ fs-layer/         # M3（Node）
│  ├─ render-bridge/    # M4（渲染进程）
│  ├─ export-engine/    # M5（主进程侧共享逻辑 + 渲染侧 HTML 组装）
│  ├─ theme-engine/     # M6（主题数据 + CSS 变量 + 内置原创主题）
│  ├─ search/           # M7 共享类型与评分算法
│  ├─ config/           # M8 schema/i18n
│  └─ ui-kit/           # 原创通用组件（菜单、树、对话框、toast）
├─ scripts/
│  ├─ build-icons.mjs            # SVG → ico/png（原创源）
│  ├─ vendor-licenses.mjs        # 生成 THIRD_PARTY_LICENSES.md + SBOM
│  ├─ verify-cleanroom.mjs       # 哈希黑名单 + 禁用串扫描（§8.5）
│  └─ perf-budget.mjs            # 冷启动/大文档时延/体积预算门禁
└─ e2e/                           # Playwright：每个里程碑的验收脚本
   ├─ ms1-*.spec.ts ... ms5-*.spec.ts
   └─ fixtures/（md 文档、主题、期望快照）
```


### 3.2 进程与窗口模型

- 单主进程 + N 个 `BrowserWindow`（每窗口一个文档上下文，FO-17 多窗口）；同一窗口内多标签 = 一个窗口内多个 `EditorPane`（共享一个 CM6 实例池或每标签一个 CM6 实例，见 §4.8）。
- 偏好/导出/关于为独立窗口（`PreferencesWindow`），与主窗口通过 IPC 通信。
- `webPreferences`：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、`webviewTag: false`；preload 仅暴露白名单 API。
- 渲染进程 CSP：`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' file: data: https:; media-src 'self' file: https:; connect-src 'self'`。

### 3.3 关键接口（TypeScript 契约）

**（1）编辑器内核 `packages/editor-kernel/src/model.ts`**

```ts
export type BlockType =
  | 'frontmatter' | 'heading' | 'paragraph' | 'blockquote' | 'list' | 'taskList'
  | 'code' | 'table' | 'math' | 'mermaid' | 'diagram' | 'html' | 'hr'
  | 'image' | 'alert' | 'toc' | 'media';

export interface Block {
  id: string;                 // 稳定 id：内容哈希 + 起始行（跨重解析复用）
  type: BlockType;
  fromLine: number; toLine: number;   // 0-based，含端点
  from: number; to: number;           // 文档字符偏移，含端点
  raw: string;                        // 原始 Markdown（序列化真源）
  text: string;                       // 去除块级语法标记后的可编辑文本
  meta: Record<string, unknown>;      // 语言/对齐/任务状态/脚注 id 等
  editable: 'inline' | 'overlay' | 'none';
  hiddenRanges: Array<{ from: number; to: number }>; // 被隐藏语法标记的源区间
}

export interface EditTransaction {
  from: number; to: number; text: string;
  userEvent?: 'input' | 'edit.block' | 'undo' | 'redo' | 'paste' | 'drop';
  cursorAnchor?: number; cursorHead?: number;
  scrollAnchor?: { blockId: string; offsetRatio: number };
}

export interface EditorKernel {
  readonly state: EditorState;
  onChange(cb: (e: ChangeEvent) => void): Disposable;
  apply(tx: EditTransaction): void;
  undo(): void; redo(): void; canUndo(): boolean; canRedo(): boolean;
  mapToSource(pos: number): number;     // 可视位置 → 源偏移
  mapFromSource(offset: number): number;// 源偏移 → 可视位置
  getBlocksInRange(fromLine: number, toLine: number): Block[];
  /** 提交渲染结果（由 M4 异步回调），以 StateEffect 写回 widget，避免整树重建 */
  commitRender(blockId: string, artifact: RenderArtifact): void;
  /** 块覆盖层编辑提交（表格/代码/公式/图表） */
  applyBlockEdit(blockId: string, nextRaw: string): void;
}
```

**（2）渲染桥接 `packages/render-bridge/src/index.ts`**

```ts
export interface RenderBridge {
  init(): Promise<void>;
  renderMath(spec: MathSpec): Promise<MathArtifact>;      // svg + 高度 + 编号
  renderMermaid(spec: MermaidSpec): Promise<MermaidArtifact>;
  renderDiagram(spec: DiagramSpec): Promise<DiagramArtifact>; // sequence/flow/zenuml
  renderCode(code: string, lang: string): Promise<CodeArtifact>; // token spans
  renderHtml(html: string, ctx: HtmlCtx): Promise<SafeHtmlArtifact>; // sanitized
  setTheme(mode: 'light' | 'dark', themeId: string, accent: string): void;
  /** 文档变更/块消失时取消其任务；渲染进程卸载时释放全部资源 */
  abort(scopeId: string): void;
  dispose(): void;
}
export interface MathRenderQueue {   // M2 侧调度策略
  request(block: Block, priority: 'visible' | 'idle'): void;
  readonly pending: number;
}
```

**（3）IPC 契约 `apps/desktop/src/main/ipc/router.ts`（preload 白名单镜像）**

```ts
export const IPC = {
  'fs:openFile':      { req: { path: string };                 res: { doc: DocSnapshot } },
  'fs:saveFile':      { req: { path: string; text: string };   res: { mtime: number } },
  'fs:listDir':       { req: { path: string; filter: FileFilter }; res: { entries: FileEntry[] } },
  'fs:crud':          { req: FileCrudCommand;                  res: { ok: boolean; undoId?: string } },
  'fs:undo':          { req: { undoId: string };               res: { ok: boolean } },
  'fs:watch':         { req: { path: string };                 res: { events: FileWatchEvent[] } }, // 主→渲染推送
  'fs:search':        { req: SearchQuery;                      res: SearchResultStream },
  'fs:quickOpen':    { req: { query: string; root: string };  res: { items: QuickOpenItem[] } },
  'export:html':      { req: HtmlExportRequest;                res: { path: string } },
  'export:pdf':       { req: PdfExportRequest;                 res: { path: string; warnings: string[] } },
  'export:docx':      { req: DocxExportRequest;                res: { path: string } },
  'export:image':     { req: ImageExportRequest;               res: { path: string } },
  'export:presets':   { req: PresetRequest;                    res: { presets: ExportPreset[] } },
  'export:detectPandoc': { req: {};                            res: { found: boolean; version?: string; path?: string } },
  'config:load':      { req: {};                               res: ConfigSnapshot },
  'config:save':      { req: { patch: ConfigPatch };           res: { ok: boolean; errors?: string[] } },
  'config:keybinding':{ req: { id: string; combo: string|null }; res: { ok: boolean } },
  'shell:openExternal': { req: { target: string };             res: { ok: boolean } },
  'app:pickFolder' / 'app:pickFile' / 'app:showSaveDialog': { /* 原生对话框 */ },
  'update:check':     { req: { channel: 'stable'|'dev' };      res: UpdateInfo },
} as const;
```

**（4）命令注册表（EC-29 / 菜单 / 右键 / Quick Open 共用）**

```ts
export interface Command {
  id: string;                    // 'file.save' | 'paragraph.heading1' | 'view.focusMode'
  title: string;                 // i18n key
  category: 'file'|'edit'|'paragraph'|'format'|'view'|'theme'|'help';
  keybinding?: string;           // 'Ctrl+S'；用户可在 conf.user.json 覆盖
  menubar?: { path: string[]; position: number };
  contextMenu?: 'editor' | 'filetree' | 'outline' | 'table';
  action: (ctx: CommandContext) => void | Promise<void>;
}
export interface CommandRegistry {
  register(cmds: Command[]): void;
  run(id: string): Promise<void>;
  setKeybinding(id: string, combo: string | null): void;   // 写回配置并热更新
  getList(): Command[];                                     // 菜单/设置面板数据源
}
```

### 3.4 UI 布局规格（对齐基准运行界面，但不复制资产）

从基准运行截图与安装包结构提取的**布局与行为规格**（只描述行为，不复制视觉资产）：

| 区域 | 规格 |
|---|---|
| 窗口 | Windows 原生标题栏（最小化/最大化/关闭）；标题格式 `文件名• - Konai`（`•` 表示未保存）；窗口样式可切换 Classic/Seamless/Unibody（WX-13） |
| 菜单栏 | 常驻自绘菜单栏（非原生 Menu 隐藏式），顺序：文件 / 编辑 / 段落 / 格式 / 视图 / 主题 / 帮助；菜单项文本即命令名（EC-29）；支持 `Alt+首字母` 键盘访问；菜单底部含"自定义快捷键"入口 |
| 侧边栏 | 左侧，顶部两个标签页「文件 / 大纲」；文件页含"文件夹路径 + 排序/新建/刷新工具条 + 列表"；宽度可拖拽记忆 |
| 编辑区 | 居中单列，最大内容宽度约 760–900 px，大量留白；标题/正文/代码块层级清晰；细分割线；无多余控件 |
| 状态栏 | 底部：左侧源码模式切换按钮（`<` / `</>`）；中部模式指示（只读/专注/打字机）；右侧 `行 / 词` 统计（WX-03）；**不得出现"未激活"角标**（合规映射 PI-09） |
| 右键菜单 | 编辑器、文件树、大纲、表格各有上下文菜单，均从 CommandRegistry 生成 |
| 主题观感 | 极简、低饱和、高对比正文；代码块浅灰底 + 等宽字体；引用块左侧竖线；标题字重分层 |

**明确禁止**：使用 Typora 名称/Logo/图标、`resources/style/themes/*.css`、`Raleway/Open Sans/PT Serif/Lato/Merriweather` 字体文件、任何 `jsc` 字节码或反编译产物。品牌名 **Konai**，图标全部原创（§8.5 净室校验）。


---

## 4. 数据流与同步策略（核心）

### 4.1 总体原则

**Markdown 源文本是唯一事实来源（Single Source of Truth）。** 编辑器模型 = 源文本 + 增量解析树 + 块模型 + 装饰集；渲染视图 = 装饰的 DOM 投影。数据流**单向**：

```text
用户输入/命令
   │ ① CM6 Transaction（源文本变化）
   ▼
EditorState.doc（源文本，唯一真源）
   │ ② 增量解析：Lezer Tree（CM6 自带增量）→ 顶层块切分 → BlockStore diff
   ▼
Block[]（含稳定 id、editable 策略、hiddenRanges）
   │ ③ 装饰增量：Decoration.add/remove（StateEffect）→ 隐藏语法标记 / 嵌入 widget
   ▼
CodeMirror DOM（WYSIWYG 视图）
   │ ④ 异步渲染：M4 渲染 widget 内容 → commitRender 写回（StateEffect）
   ▼
用户看到渲染结果（数学/图表/代码/表格/图片）
```

**反向通道**（用户直接编辑渲染结果）只有三类，全部收敛为"对源文本的事务"：
1. **行内编辑**（粗体/斜体/行内代码/行内数学/链接文字）：装饰只隐藏语法标记，字符仍在源中，CM6 原生编辑即可，无需反向映射。
2. **块级结果编辑**（表格单元、任务复选框、图片替换）：widget 上绑定交互，点击后弹出**覆盖层源编辑器**（`OverlayEditor`，见 §4.3），提交时调用 `applyBlockEdit(blockId, nextRaw)` → 替换源区间。
3. **整块源编辑**（代码块/公式/图表）：点击块 → 覆盖层打开该块原始 Markdown → 提交回源。

**禁止**：把渲染视图当作可序列化状态；禁止从 DOM 反解 Markdown（唯一例外是"复制为 HTML/纯文本"这类只读导出，且必须从源文本重新渲染）。

### 4.2 块级增量解析（复杂度 O(变更块数)）

不使用"每次输入全文重解析"。利用 CodeMirror 6 已增量维护的 Lezer 语法树：

```text
输入：旧 BlockStore + 新 EditorState（含 Lezer Tree + ChangeDesc）
步骤：
1. 用 changeDesc 计算受影响行区间 [changedFromLine, changedToLine]；
2. 向上/向下扩展到"块安全边界"（空行、ATX 标题行、围栏起止行、表格分隔行、块引用/列表的缩进父级）；
3. 仅在扩展区间内调用 extractBlocksFromTree(state, tree, fromLine, toLine)：
   - 遍历顶层节点（heading/paragraph/blockquote/list/codeFence/table/htmlBlock/leafWidget…），
   - 按行号生成 Block，计算 from/to 偏移与 raw；
4. BlockStore.diff(oldBlocks, newBlocks)：
   - 以"内容哈希 + 起始行"生成稳定 id；
   - 未变化块复用旧对象（保留渲染缓存与 widget 状态）；
   - 产出 dirtyBlocks（新增/修改/删除）；
5. 仅对 dirtyBlocks 生成装饰增量（Decoration.add/remove），不重建整树。
```

配套：**防抖**（输入 16 ms 合并、widget 渲染 50 ms 合并）+ **rAF 批量提交**，保证 500 KB 文档输入不卡顿（性能预算见 §8.6）。

### 4.3 三种渲染策略（按块类型选择）

| 策略 | 适用块 | 实现 | 编辑方式 |
|---|---|---|---|
| **A. 软 WYSIWYG（隐藏语法）** | 标题、段落、粗体/斜体/删除线/行内代码/链接/图片、任务列表标记、列表标记、引用竖线 | `replace` 零宽装饰隐藏 ` #* []() ` 等标记；`line` 装饰做字号/缩进/竖线/复选框 | 直接编辑文字，语法由 CM6 自动维护 |
| **B. 硬渲染 widget** | 数学、Mermaid/图表、代码块、表格、图片、HTML、媒体、`[toc]`、Alert | `replace: true` 的 block widget，渲染 M4 产物；widget 高度变化不影响源行位置 | 点击 → 覆盖层编辑源（表格提供网格 + 悬浮工具条） |
| **C. 源模式** | 整文档 | CM6 原生高亮（`@codemirror/lang-markdown`） | `Ctrl+/` 切换，滚动位置保留（EC-30） |

策略 A 的关键是**零宽隐藏**（不删除字符），因此源偏移与可视位置一一对应，天然避免光标漂移；策略 B 的源区间仍保留在文档中（保证序列化零损耗），但光标不可进入，由 §4.4 的吸附规则处理。

### 4.4 光标保持（重点）

**目标**：渲染导致 DOM 高度变化、块增删、主题切换时，光标与视口不跳动。

1. **事务级映射**：所有源文本变化走 `EditorKernel.apply(tx)`，CM6 自动用 `ChangeDesc.mapPos(pos, assoc)` 维护 `anchor/head`；内核额外保存 `logicalAnchor`（源偏移），重渲染后用 `mapFromSource` 回写。
2. **隐藏区间映射表**：每个 Block 携带 `hiddenRanges`（被零宽隐藏的源区间）。当 `posAtCoords` 落在隐藏区间内时，用 `cursor.snapToEditable(pos, dir)` 吸附到区间左/右最近的可编辑位置（Typora 的行为：点击 `**` 位置会落到加粗文本内）。
3. **widget 边界吸附**：光标不允许停在 `replace: true` 的 widget 内部；`TransactionFilter` 拦截并吸附到 widget 前/后（按移动方向）。
4. **滚动锚点**：重渲染前记录 `scrollAnchor = { blockId, offsetRatio }` 与垂直偏移；渲染完成后按 `blockId` 重新定位（BlockStore 的稳定 id 保证可寻址）。**不依赖"行号"寻址**，因此 widget 高度变化不破坏锚点。
5. **异步渲染不回填光标**：`commitRender` 只更新 widget 内容，不触发 selection 变更；若渲染期间用户正在输入，丢弃过期 artifact（`abort(scopeId)` + 版本号校验，§4.7）。
6. **黄金用例测试**（`packages/editor-kernel/test/cursor.spec.ts`）：隐藏标记点击、widget 前后移动、块增删后光标、撤销后光标、长文档 1000 次输入后光标一致性。

### 4.5 撤销栈（三层）

| 层 | 范围 | 实现 | 合并策略 |
|---|---|---|---|
| L1 文本 | 源文本输入/删除 | CM6 `history()` + `userEvent` | 连续输入按 500 ms 合并；`edit.block` 独立成组 |
| L2 块结果 | 复选框切换、表格单元编辑、覆盖层提交 | 转为 L1 事务（`userEvent: 'edit.block'`） | 一次交互 = 一个事务；表格多次编辑合并为一次（`addToHistory: false` 中间态） |
| L3 文件 | 新建/重命名/移动/删除（入回收站） | `CommandStack`：`{do, undo, redo}`，删除记录原路径与时间 | 每个操作独立；删除可撤销（FO-19） |

**外部修改重载**：重载前快照当前文档并压入 L3（可撤销）；重载后保留撤销入口（"撤销重载"），对齐基准 1.14.15 的外部重载修复（FO-16）。

### 4.6 渲染管线与异步调度

```text
BlockStore diff → dirtyBlocks
   ├─ 可见块（IntersectionObserver 判定）：priority = visible，立即入队
   └─ 视口外块：priority = idle，空闲时渲染（避免大文档首屏阻塞）
渲染队列（单飞 + 每类渲染器并发上限 2）
   ├─ MathJax：单例初始化一次；tex2svgAsync；主题切换 → typesetClear + 重渲染可见块
   ├─ Mermaid：mermaid.initialize 一次；render() 使用唯一 nodeId；失败回退为代码块展示
   └─ 代码块：同步 token 化（无异步）
结果 → commitRender(blockId, artifact) → StateEffect → 装饰更新
取消：文档变更时 abort(scopeId=blockId)；窗口关闭时 dispose()
```

**主题切换**：M6 发布 `theme:changed` 事件 → M4 `setTheme()` → 清缓存并按可见性重渲染；**不重建 CM6 实例**（避免光标丢失）。

### 4.7 竞态与一致性

- 每个渲染任务携带 `version`（BlockStore 修订号），`commitRender` 校验版本，过期丢弃。
- 保存采用**写前快照 + 原子写**（临时文件 + rename）；保存时若检测到外部 mtime 变化，提示冲突（FO-16）。
- 多标签/多窗口共享 M3 文件状态：同一文件被两个标签编辑时，以"最后写入 + 显式冲突提示"处理（P1 范围，允许简单策略）。
- IPC 全部经 zod 校验；渲染进程永不直接访问 Node API。

### 4.8 大文档与多标签资源策略

- 单文档 > 2 MB 时：关闭全文扫描类装饰，仅渲染可见区；查找替换走增量扫描。
- 多标签：非激活标签的 CM6 视图可"休眠"（保留状态与滚动锚点，卸载 DOM 装饰缓存），切换时恢复（FO-17）。
- 内存预算：单窗口渲染进程 < 500 MB（500 KB 文档 + 20 个 Mermaid 图）；超限告警并释放 idle 块缓存。


---

## 5. 依赖清单与许可

### 5.1 运行时依赖（打包进分发物）

| 包 | 版本（构建时以最新稳定为准） | 许可证 | 用途 | 打包 |
|---|---|---|---|---|
| electron | ^37 | MIT | 宿主 | 是 |
| react / react-dom | ^19 | MIT | UI | 是 |
| @codemirror/{state,view,commands,language,search,autocomplete,lang-markdown,legacy-modes} | ^6 | MIT | 编辑器内核 | 是 |
| @lezer/{markdown,lr,common} | ^1 | MIT | 增量解析 | 是 |
| markdown-it | ^14 | MIT | 解析/序列化补充（HTML 导出、front matter） | 是 |
| mathjax | ^4.1 | Apache-2.0 | 数学渲染（懒加载） | 是 |
| mermaid | ^11 | MIT | 图表（懒加载） | 是 |
| d3（mermaid 依赖） | ^7 | ISC / BSD-3 | 图表 | 是（懒加载） |
| pdf-lib | ^1.17 | MIT | PDF 书签/大纲后处理 | 是 |
| docx | ^9 | MIT | docx 导出（替代 Pandoc） | 是 |
| chokidar | ^4 | MIT | 文件监听 | 是 |
| vscode-ripgrep | ^1.10 | MIT / Unlicense（ripgrep 本体） | 全局搜索 | 是（二进制） |
| zustand | ^5 | MIT | 渲染进程状态 | 是 |
| zod | ^3 | MIT | IPC/配置校验 | 是 |
| katex | ^0.16 | MIT | 可选快速路径（默认不启用） | 否 |

### 5.2 构建期依赖（不打包）

electron-vite（MIT）、vite（MIT）、typescript（Apache-2.0）、electron-builder（MIT）、Inno Setup 6（脚本自有，免费再分发）、playwright（Apache-2.0）、vitest（MIT）、@types/*（MIT）、eslint/prettier（MIT）。

### 5.3 字体与图标（净室）

| 类别 | 选择 | 许可证 | 说明 |
|---|---|---|---|
| UI 字体 | 系统字体栈（Segoe UI / 微软雅黑）+ 可选打包 **Noto Sans SC** 子集 | OFL-1.1 | 系统字体仅引用不打包；打包字体必须为 OFL，且**子集化**（fonttools，MIT）控制体积 |
| 等宽字体 | **Cascadia Code** / **JetBrains Mono** | OFL-1.1 | 代码块与源码模式 |
| PDF 嵌入 | 同上打包字体 + 系统字体回退 | — | 导出 PDF 必须嵌入所用字体子集（见 §7 R3） |
| 图标 | **全部原创 SVG**（项目自有，可标 MIT/CC0） | 自有 | 由 `scripts/build-icons.mjs` 生成 ico/png；禁止复用基准包图标 |
| 主题 | **全部原创 CSS**（风格贴近极简气质） | 自有/MIT | 禁止复用 `resources/style/themes/*.css` |

### 5.4 许可证合规策略

1. **Copyleft 零容忍**：CI 许可证扫描（`scripts/vendor-licenses.mjs`）拒绝 GPL/AGPL/LGPL 进入运行时依赖树（构建期工具除外，且不得进入分发物）。
2. **Pandoc 不打包**：Pandoc 为 GPL-2.0+，**不作为依赖、不随包分发、不链接**；仅作为用户自行安装的外部程序被检测与调用（EX-05/06/07/12 的降级路径）。docx 导出改用 npm `docx`（MIT）自写，保证 EX-05 默认可用。
3. **Electron ffmpeg 组件**：Electron 分发的 `ffmpeg.dll` 可能含非自由编解码器（H.264/AAC）。Konai 不需要音视频编解码 → 打包时通过 `afterPack` 删除未使用的 ffmpeg 组件（或替换为自由编解码版本），并在合规清单中记录。
4. **遥测**：默认**零遥测**（不收集任何使用数据），对齐基准 1.13 起"匿名统计默认关闭"且更进一步。
5. **SBOM**：每次打包生成 `THIRD_PARTY_LICENSES.md`（含传递依赖许可证）随安装包分发。


---

## 6. 里程碑计划（5 个，P0 → P1 → P2）

> 编号约定：条目 ID = 矩阵行顺序编号（附录 §9 给出 113 条全量映射）。每个里程碑均通过"演示 + 对照清单 + 自动化验收"三件套验证；每个里程碑末尾跑 `npm run verify:cleanroom && npm run verify:licenses`。

### MS1 — 可安装的实时编辑内核（P0 编辑核心 + 外壳）

- **演示内容**：安装 Konai（Inno 静默安装），双击打开一个 `.md`；在同一窗口内输入 `# 标题`、`**粗体**`、行内代码、`- [ ] 任务`、表格、`` ```js `` 代码块、`$E=mc^2$`，语法标记实时隐藏、结果原地渲染；左侧「文件 / 大纲」侧边栏可浏览文件夹；底部状态栏显示行/词；Ctrl+S 保存、Ctrl+Z 撤销；标题栏出现 `•` 未保存标记。
- **对应矩阵条目**：EC-01、EC-02、EC-03、EC-04、EC-05、EC-06、EC-07、EC-08、EC-10、EC-17；ER-01、ER-08；FO-01、FO-05、FO-06、FO-19；WX-03；PI-01
- **验收方式**：
  - `e2e/ms1-wysiwyg.spec.ts`：输入 → 渲染断言（快照）→ 保存 → 重开内容一致；
  - 静默安装参数 `/VERYSILENT /CURRENTUSER /DIR=<tmp>` 退出码 0，桌面/开始菜单快捷方式存在；
  - 与基准截图并排人工对比：菜单栏六项、侧边栏两 tab、状态栏元素齐全；
  - 撤销/重做黄金用例通过（1000 步随机输入后光标仍正确）。

### MS2 — P0 渲染与导出（P0 扩展渲染 + 导出引擎）

- **演示内容**：打开含脚注、`[toc]`、GFM Alert、表格、代码块（多语言）、Mermaid 流程图/时序图/甘特图、行内与块级数学的文档，全部原地渲染；`[toc]` 随标题变化自动更新；File → Export → PDF（设置页边距/页眉页脚/页面分隔）与 HTML（含样式/无样式）导出成功；打印预览可用。
- **对应矩阵条目**：EC-12、EC-14、EC-15、EC-16、EC-18；ER-01、ER-02、ER-03、ER-04、ER-05、ER-07、ER-08、ER-09；EX-01、EX-03、EX-04、EX-11；FO-16
- **验收方式**：
  - `e2e/ms2-export.spec.ts`：pdf-lib 校验 PDF 页数、页边距（用户设定值 ±2pt）、页眉页脚文本、暗色背景像素抽样；
  - 导出 HTML 与源文档结构 diff（标题/表格/代码/数学占位）；
  - Mermaid ≥ 20 种图类型逐一渲染成功（ER-05；内联配置 ER-14 可放 MS5）；
  - 外部修改文件后重载行为正确（FO-16）。

### MS3 — P1 写作与组织（多标签/搜索/主题/自动保存）

- **演示内容**：多标签与多窗口切换、恢复关闭文件；Ctrl+P Quick Open 模糊打开；全局搜索（正则/文件名）；最近文件（固定/取消）；专注模式与打字机模式；5 套内置主题即时切换 + `base.user.css` 自定义；字体族/字号；自动保存（5 分钟）与草稿恢复；拼写检查；查找替换（正则/大小写/全词/计数）；`Ctrl+/` 源码模式切换且滚动位置保留。
- **对应矩阵条目**：EC-11、EC-13、EC-19、EC-23、EC-24、EC-29、EC-30、EC-33、EC-35；ER-02、ER-04、ER-05、ER-07、ER-09；FO-02、FO-03、FO-07、FO-08、FO-09、FO-13、FO-17；WX-01、WX-02、WX-05、WX-07、WX-08、WX-09、WX-10、WX-16；PI-02、PI-04
- **验收方式**：
  - `e2e/ms3-*.spec.ts`：每个 P1 条目一个用例；设置项往返（`conf.user.json` 读写一致）；
  - 源码模式切换后滚动偏移偏差 ≤ 2 px；
  - 自动保存：杀进程后重启可恢复草稿；
  - 主题切换后数学/代码/Mermaid 颜色正确（截图断言）；
  - 键位自定义：改 `Ctrl+B` 后菜单与实际行为同步。

### MS4 — P1 导出与平台集成收尾

- **演示内容**：导出预设（目标格式/扩展名/模板/自定义 CSS/参数/变量占位 outputFolder、currentFolder、filename）；导出 docx（**内置写入器，无需 Pandoc**）；复制/导出为图片（文档/选区/图表/公式）；暗色主题导出 PDF 保留背景；Pandoc 缺失时的检测与安装引导；`.md` 文件关联与"新建 → Markdown"菜单；`konai` 命令行调用；检查更新入口。
- **对应矩阵条目**：EX-02、EX-05、EX-08、EX-09、EX-12、EX-13；FO-18；WX-06；PI-02、PI-03、PI-04、PI-05
- **验收方式**：
  - 导出预设 round-trip（保存→重开→一致）与变量替换结果断言；
  - docx 在 Word/WPS 打开无错位（人工 + 解析断言）；
  - 暗色 PDF：像素抽样背景色与主题一致；
  - Pandoc 未安装时 UI 显示引导而非报错（EX-12）；
  - 文件关联后双击 `.md` 启动 Konai 并打开文件（PI-02/04 自动化）；
  - **合规断言**：安装包与运行时无激活/试用/付费提示，无网络上报（PI-09 映射）。

### MS5 — P2 收尾 + 净室与全量回归

- **演示内容**：文章列表视图、侧边栏过滤/排序/键盘导航、图片管理（复制/移动/下载/重命名/删除全部图片）与上传器、窗口样式与窗口行为（置顶/全屏/缩放/Ctrl+滚轮）、行尾与编码（CRLF/LF、按编码重开、末尾换行）、编辑器浮动工具栏、字数弹层、大纲弹层、版本浏览、多显示器/高 DPI；随后执行 113 条全量回归与净室审计。
- **对应矩阵条目**：EC-20、EC-21、EC-22、EC-25、EC-26、EC-27、EC-28、EC-31、EC-32、EC-34、EC-36；ER-03、ER-06、ER-10、ER-11、ER-12、ER-13、ER-14、ER-15；FO-04、FO-10、FO-11、FO-12、FO-14、FO-15、FO-18；EX-06、EX-07、EX-10、EX-14；WX-04、WX-06、WX-11、WX-12、WX-13、WX-14、WX-15、WX-17、WX-18；PI-03、PI-06、PI-07、PI-08、PI-10
- **验收方式**：
  - 全量 113 条清单回归（`e2e/full-matrix.spec.ts` 逐条断言，P0/P1 必须 100% 通过，P2 允许已知例外并记录）；
  - **明确不做**：PI-11（Windows ARM，基准 x64 不支持，超出基线）；EX-14 按"尽力附加书签 + 失败可提示"实现；
  - 净室审计：资源哈希黑名单零命中、禁用串零命中、`ASSET_PROVENANCE.md` 完整；
  - 性能预算：冷启动 < 2.5 s、500 KB 文档打开 < 500 ms、安装包体积与依赖 SBOM 报告（`scripts/perf-budget.mjs`）；
  - 许可：CI 扫描无 GPL/AGPL/LGPL 运行时依赖。


---

## 7. 风险清单与缓解（8 个）

### R1 块级实时渲染的光标漂移与视口跳动（严重度：高）

- **现象**：隐藏语法/替换 widget 后，点击、输入、块增删导致光标跳到错误位置或视口突然滚动；长文档输入时累积偏移。
- **影响**：直接破坏 P0「实时预览」与 Typora 老用户的手感，属产品成败级风险。
- **缓解**：
  1. 源文本单一真源 + **零宽隐藏**（不删字符）保证偏移一一对应（§4.3）；
  2. 块 widget 边界吸附 + `TransactionFilter` 拦截（§4.4）；
  3. 滚动锚点用稳定 `blockId` 而非行号（§4.4.4）；
  4. 异步渲染只更新 widget 内容、不回写 selection（版本号校验）；
  5. 建立**光标黄金用例库**（点击隐藏标记、widget 前后、块增删、撤销、千步输入），CI 强制通过；
  6. 性能防抖（输入 16 ms / 渲染 50 ms / rAF 批量）。
- **验证**：`packages/editor-kernel/test/cursor.spec.ts` + e2e 千步随机输入后光标/滚动偏差 = 0。

### R2 Mermaid / MathJax 与编辑器生命周期冲突（严重度：高）

- **现象**：重复渲染、内存泄漏、暗色主题切换后图表不更新或错色、文档切换后旧任务写回新块、MathJax/Mermaid 实例竞争导致白屏。
- **影响**：ER-01~ER-14 大面积不可用；渲染进程崩溃。
- **缓解**：
  1. 每个块渲染任务带 `scopeId=blockId` 与版本号，变更即 `abort`，过期结果丢弃（§4.7）；
  2. 单例初始化 + 单飞队列 + 并发上限 2；视口外懒渲染（IntersectionObserver）；
  3. 主题切换走 `setTheme()` + 清理重渲染可见块，**不重建 CM6 实例**；
  4. 窗口/标签关闭调用 `dispose()`；Mermaid 渲染失败回退为代码块展示（不阻塞编辑）；
  5. CSP 禁用 `eval`；`iframe` 白名单沙箱。
- **验证**：内存测试（反复开关文档 100 次渲染进程 RSS 稳定）、主题切换截图断言、abort 竞态用例。

### R3 PDF 导出字体嵌入 / 中文 / 暗色背景 / 书签一致性（严重度：中高）

- **现象**：中文变方框或字体未嵌入（换机丢失）、暗色背景丢失、页眉页脚/页码错乱、书签/大纲缺失或指向错误页。
- **影响**：EX-01/02/11/14 是 P0/P1 验收项，直接影响"导出 PDF"这一核心卖点。
- **缓解**：
  1. 导出文档使用 `@font-face` 引用**打包的 OFL 字体子集**（Noto Sans SC / Cascadia Code），确保 Chromium 嵌入字体子集；
  2. `printBackground: true` + CSS `-webkit-print-color-adjust: exact`，背景色取 `getComputedStyle(body).backgroundColor`（对齐基准 `export.getPageColor` 逻辑）；
  3. 页眉页脚用 Chromium `headerTemplate/footerTemplate`（内置 pageNumber/totalPages）；页面分隔用 `break-before: page`；
  4. 书签/大纲用 `pdf-lib` 后处理：打印前在 DOM 中给标题加 `data-konai-bookmark`，打印后按分页标记计算页码写入 PDF Outline；失败时给出警告（对齐 EX-14）；
  5. 建立 PDF 结构断言（pdf-lib 读取 /Font、/Outline、页面尺寸、背景像素抽样）。
- **验证**：`e2e/ms2-export.spec.ts` 的 PDF 结构断言 + 人工在 Edge/Adobe 打开检查。

### R4 Pandoc 的 Copyleft 与可选依赖可得性（严重度：中）

- **现象**：为做 docx/odt/epub 导出而打包 Pandoc（GPL-2.0+）导致分发物受 Copyleft 约束；或用户无 Pandoc 导致 EX-05/06/07 不可用。
- **缓解**：**不打包、不链接、不分发 Pandoc**；docx 用 npm `docx`（MIT）内置写入器默认可用；Pandoc 仅作可选外部程序被检测（版本校验、路径配置、安装引导，EX-12），文档明确其许可证由用户自行负责；构建镜像中如需测试，仅在 CI 临时下载、不进入产物。
- **验证**：许可证扫描（无 GPL 运行时依赖）+ `e2e/ms4-pandoc.spec.ts`（缺失时引导、存在时调用）。

### R5 Electron 打包体积、启动速度与 ffmpeg 组件许可（严重度：中）

- **现象**：安装包 > 150 MB、冷启动 > 4 s；Electron 自带 ffmpeg 含非自由编解码器。
- **缓解**：Vite 分包 + MathJax/Mermaid 懒加载 + asar + 只产出 x64 + 删除未用 ffmpeg 组件（`afterPack`）+ 不发布 Sourcemap；性能预算门禁（§8.6）。
- **验证**：`scripts/perf-budget.mjs`（冷启动、500 KB 打开时延、体积）；合规清单记录 ffmpeg 处理方式。

### R6 净室合规：误用基准包资源（严重度：高，合规性）

- **现象**：构建 Agent 图省事从 `_work/typora_inst` 复制图标/主题/字体/CSS，或从 jsc 反编译出代码。
- **缓解**：
  1. `_work/typora_inst` 只读、不进入构建输入；构建脚本**无该目录的读取权限**（路径白名单）；
  2. `cleanroom/typora-file-hashes.txt` 黑名单 + `verify-cleanroom.mjs` 对产物做哈希比对；
  3. 禁用串扫描（Typora 品牌、原主题文件名、`typora-root-url` 之外的原资源名）；
  4. `ASSET_PROVENANCE.md` 逐项登记来源/作者/许可证，无来源即不打包；
  5. 代码全部自研，禁止反编译/反混淆基准包；调研结论仅作行为规格输入。
- **验证**：每个里程碑 `npm run verify:cleanroom`；最终审计由 Lead 复核 diff。

### R7 任意 Markdown（含裸 HTML/front matter）在 WYSIWYG 下的保真度（严重度：中高）

- **现象**：复杂嵌套（引用内表格、列表内代码、HTML 块夹行内标签）、front matter、`[toc]`、Alert 转换在"隐藏语法 + widget"策略下渲染异常或序列化改动。
- **缓解**：解析层以 Lezer 树为准（结构与 CommonMark/GFM 一致）；未知/复杂结构降级为"代码/源块展示"而非强行渲染；front matter 与 HTML 块默认不渲染正文（对齐基准）；建立**渲染保真度测试集**（每类结构 → 渲染截图 + 序列化 diff 必须为空）。
- **验证**：`packages/editor-kernel/test/roundtrip.spec.ts`（源→视图→源 零改动）。

### R8 离线/受限网络下的依赖可得性（严重度：中）

- **现象**：构建机访问 `github.com` 超时（**本次实测 electron releases 页面超时**），Electron 二进制与 electron-builder 二进制下载失败。
- **缓解**：`ELECTRON_MIRROR` / `ELECTRON_BUILDER_BINARIES_MIRROR` 指向 `https://registry.npmmirror.com/-/binary/...`（**实测 200**）；npm registry 可用官方源或 npmmirror；CI 镜像缓存 `~/.npm` 与 Electron 缓存；文档记录离线构建步骤（先在线 `npm ci` 并缓存，再离线试产）。
- **验证**：干净目录 + 镜像环境变量下 `npm ci && npm run dist` 成功。


---

## 8. 给构建 Agent 的施工要点

### 8.1 工程初始化（顺序不可颠倒）

```powershell
cd E:\deepseek-harness\konai
# 1) 工作区与 registry（实测：Node v25.8.1 / npm 11.11.0 可用；pnpm 版本异常，故用 npm workspaces）
npm config set registry https://registry.npmmirror.com
$env:ELECTRON_MIRROR = "https://registry.npmmirror.com/-/binary/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://registry.npmmirror.com/-/binary/electron-builder-binaries/"
# 2) 安装（锁定 lockfile，save-exact）
npm install
# 3) 内核先行：纯 TS 单测必须绿
npm run -w @konai/editor-kernel test
npm run -w @konai/editor-kernel test:cursor
# 4) 类型与单测门禁
npm run typecheck && npm run test
```

### 8.2 脚本清单（根 `package.json`）

```jsonc
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "typecheck": "tsc -b --pretty",
    "test": "vitest run",
    "dist": "electron-vite build && electron-builder --config electron-builder.yml && node scripts/inno-pack.mjs",
    "dist:dir-only": "electron-builder --win --x64 --dir",
    "verify:cleanroom": "node scripts/verify-cleanroom.mjs",
    "verify:licenses": "node scripts/vendor-licenses.mjs --fail-on copyleft",
    "verify:perf": "node scripts/perf-budget.mjs",
    "icons": "node scripts/build-icons.mjs",
    "e2e": "playwright test"
  }
}
```

### 8.3 建议施工顺序（与里程碑对齐）

1. **骨架**：npm workspaces + tsconfig + electron-vite + 主进程窗口 + preload 白名单 + CSP（M1 最小可用）。
2. **内核**：`@konai/editor-kernel` 的 parser/BlockStore/光标映射/撤销 + 单测（MS1 技术底座）。
3. **WYSIWYG**：装饰管线 + 行内隐藏 + 块 widget（M2/M4 对接）。
4. **FS 与外壳**：文件树/列表/大纲 + 新建/打开/保存/删除入回收站 + 多标签（M1/M3/M7）。
5. **导出**：HTML → PDF → docx → 图片（M5），每完成一项补一条 e2e。
6. **主题与偏好**：主题引擎 + 设置面板 + i18n（M6/M8）。
7. **打包**：electron-builder + Inno Setup + 图标（原创）+ SBOM/净室校验。
8. **P1/P2 收尾**：搜索/Quick Open/拼写/上传器/窗口行为/多显示器。
9. **全量回归**：`e2e/full-matrix.spec.ts` + 净室 + 许可 + 性能门禁。

### 8.4 机读验收映射（配套产物）

产出 `docs/stage2-architecture.spec.json`：包含 113 条 `{id, name, priority, dimension, milestone, acceptance}`，与附录 §9 一致，供 e2e 脚本与验收报表机读。**任何矩阵条目优先级或验收标准变更，必须同步更新该文件与本方案。**

### 8.5 净室与质量门禁（每个里程碑必跑）

```powershell
npm run verify:cleanroom   # 哈希黑名单 + 禁用串 + 构建输入路径白名单
npm run verify:licenses    # 运行时依赖无 GPL/AGPL/LGPL；生成 SBOM
npm run verify:perf        # 冷启动/打开时延/体积预算
npm run e2e                # 里程碑对应 spec
```

**DoD（每次提交）**：typecheck 绿、单测绿、新增功能有对应 e2e、净室零命中、许可扫描通过、diff 经 Lead 复核。

### 8.6 性能预算（可量化验收）

| 指标 | 预算 | 测量方式 |
|---|---|---|
| 冷启动到可输入 | ≤ 2.5 s | Playwright 计时（中等机器） |
| 500 KB Markdown 打开 | ≤ 500 ms | 主进程 `fs:openFile` → 首屏渲染完成 |
| 输入帧率 | ≥ 55 fps（1000 行文档） | CM6 事务耗时采样 |
| 安装包体积 | ≤ 130 MB（x64） | 构建产物统计 |
| 渲染进程内存（500 KB + 20 图） | ≤ 500 MB | `process.memoryUsage` |

### 8.7 目录与命名约定

- 包命名：`@konai/<module>`；工作区 `apps/*`、`packages/*`。
- 命令 id 点分命名（`file.save`、`paragraph.heading1`）；条目 ID 用附录编号（EC-01…PI-11）。
- 配置键与基准 `conf.default.json` 语义对齐（便于老用户迁移习惯），但**不复制其文件内容**。
- 源码注释与提交信息用中文或英文均可，但**对外文案统一中文优先**（矩阵基准为中文界面）。


---

## 9. 附录：矩阵条目编号索引（113 条）

> ID 规则：维度前缀 + 矩阵行顺序（从 1 开始）。优先级取自矩阵；「里程碑」列指主要验收里程碑（部分条目跨里程碑回归）。

### 9.1 编辑核心（EC-01 ~ EC-36）

| ID | 功能 | 优先级 | 里程碑 |
|---|---|---|---|
| EC-01 | 实时预览（所见即所得混合编辑） | P0 | MS1 |
| EC-02 | GitHub Flavored Markdown 解析 | P0 | MS1 |
| EC-03 | 标题 H1–H6 与标题层级增减 | P0 | MS1 |
| EC-04 | 段落与换行（单空行分段、Shift+Enter、行尾两空格） | P0 | MS1 |
| EC-05 | 块引用（含多级嵌套） | P0 | MS1 |
| EC-06 | 有序/无序列表（缩进、类型切换） | P0 | MS1 |
| EC-07 | 任务列表（点击复选框、Toggle Task Status） | P0 | MS1 |
| EC-08 | 围栏代码块与语言标注 | P0 | MS1 |
| EC-09 | 表格（创建、编辑、对齐、行列增删与移动） | P0 | MS1（基础）/ MS3（工具条） |
| EC-10 | 行内样式（粗体/斜体/粗斜体/删除线/行内代码/链接/图片） | P0 | MS1 |
| EC-11 | 自动链接与文档内锚点链接 | P1 | MS3 |
| EC-12 | 脚注与悬停预览 | P1 | MS2 |
| EC-13 | 行内 HTML（`<u>`/`<span>`/注释/`<kbd>`） | P1 | MS3 |
| EC-14 | YAML Front Matter | P1 | MS2 |
| EC-15 | `[toc]` 目录自动生成与更新 | P1 | MS2 |
| EC-16 | GitHub Style Alerts | P1 | MS2 |
| EC-17 | 行内数学 `$...$` 与块级 `$$...$$` | P0 | MS1 |
| EC-18 | LaTeX 分隔符 `\(...)` 与 `\[...\]` | P1 | MS2 |
| EC-19 | 数学自动编号（无/AMS/全部） | P1 | MS3 |
| EC-20 | 上标 `^…^` 与下标 `~…~`（默认关闭） | P2 | MS5 |
| EC-21 | 高亮 `==…==`（默认关闭） | P2 | MS5 |
| EC-22 | Emoji 短代码与直接输入 | P2 | MS5 |
| EC-23 | 自动配对（括号/引号/Markdown 符号） | P1 | MS3 |
| EC-24 | 智能标点（Smart Quotes / Smart Dashes） | P1 | MS3 |
| EC-25 | 注释与 HTML 块 | P2 | MS5 |
| EC-26 | 代码块行号开关 | P2 | MS5 |
| EC-27 | 代码块复制内容/自动缩进/跳到行首行尾 | P2 | MS5 |
| EC-28 | 空白与换行偏好 | P2 | MS5 |
| EC-29 | 快捷键自定义（`conf.user.json` → keyBinding） | P1 | MS3 |
| EC-30 | 源码模式/混合视图切换（`Ctrl+/`）与滚动保留 | P1 | MS3 |
| EC-31 | 只读模式（Readonly Mode） | P2 | MS5 |
| EC-32 | 行/段落上下移动（`Alt+↑/↓`） | P2 | MS5 |
| EC-33 | 复制为 Markdown/HTML/纯文本/无主题样式 | P1 | MS3 |
| EC-34 | 选择行/句/样式域/词 | P2 | MS5 |
| EC-35 | 查找与替换（正则、大小写、全词、计数） | P1 | MS3 |
| EC-36 | 块级删除/样式清除 | P2 | MS5 |

### 9.2 扩展渲染（ER-01 ~ ER-15）

| ID | 功能 | 优先级 | 里程碑 |
|---|---|---|---|
| ER-01 | MathJax v4 数学渲染 | P0 | MS1 |
| ER-02 | TeX 宏与宏包（ams/physics/xypic/bboldx/begingroup/textmacros） | P1 | MS2 |
| ER-03 | MathJax 辅助 MathML 输出 | P2 | MS5 |
| ER-04 | Mermaid 11.13 图表渲染 | P1 | MS2 |
| ER-05 | Mermaid 图表类型 ≥ 20 种 | P1 | MS2 |
| ER-06 | ZenUML 图表 | P2 | MS5 |
| ER-07 | js-sequence-diagrams 与 flowchart.js | P1 | MS2 |
| ER-08 | 代码语法高亮（CodeMirror，语言清单） | P0 | MS1 |
| ER-09 | 表格可视化编辑（工具条/拖拽/多列对齐） | P1 | MS3 |
| ER-10 | 图片语法切换（Markdown/HTML）与缩放 | P2 | MS5 |
| ER-11 | 复制为图片（数学/图表/表格） | P2 | MS5 |
| ER-12 | 数学复制为 MathML/TeX | P2 | MS5 |
| ER-13 | 视频/音频/iframe 嵌入（含 `<track>` 相对路径） | P2 | MS5 |
| ER-14 | Mermaid 内联配置（`%%{init:...}%%`） | P2 | MS5 |
| ER-15 | 代码语言自动补全与默认语言记忆 | P2 | MS5 |

### 9.3 文件与组织（FO-01 ~ FO-19）

| ID | 功能 | 优先级 | 里程碑 |
|---|---|---|---|
| FO-01 | 左侧边栏（文件/大纲 两个面板） | P0 | MS1 |
| FO-02 | 文件列表视图与文件树视图（独立配置） | P1 | MS3 |
| FO-03 | 大纲面板（可折叠/平面、过滤、跳转、高亮当前标题） | P1 | MS3 |
| FO-04 | 文章列表视图 | P2 | MS5 |
| FO-05 | 打开文件夹/文件/最近 | P0 | MS1 |
| FO-06 | 新建文件/文件夹、重命名、移动、删除（回收站、可撤销） | P0 | MS1 |
| FO-07 | 最近文件与最近位置（固定/取消/清除） | P1 | MS3 |
| FO-08 | Quick Open（`Ctrl+P`，模糊匹配文件名与路径） | P1 | MS3 |
| FO-09 | 全局搜索（跨文件内容、正则、文件名校验） | P1 | MS3 |
| FO-10 | 侧边栏文件过滤（隐藏文件、非 Markdown、自定义 glob） | P2 | MS5 |
| FO-11 | 文件树键盘导航 | P2 | MS5 |
| FO-12 | 排序（名称/修改/创建、自然排序、按文件夹分组） | P2 | MS5 |
| FO-13 | 图片管理（复制/移动/下载/重命名/删除全部图片） | P1 | MS3 |
| FO-14 | 图片上传器（iPic/PicGo/Picsee/自定义命令） | P2 | MS5 |
| FO-15 | 默认文件类型/扩展名与拖拽行为配置 | P2 | MS5 |
| FO-16 | 外部修改检测与从磁盘重新加载 | P1 | MS2 |
| FO-17 | 多标签与多窗口（New Tab/切换/New Window/恢复关闭） | P1 | MS3 |
| FO-18 | 文件包（TextBundle/TextPack）支持 | P2 | MS4 |
| FO-19 | 撤销/重做（含删除文件撤销） | P0 | MS1 |


### 9.4 导出（EX-01 ~ EX-14）

| ID | 功能 | 优先级 | 里程碑 |
|---|---|---|---|
| EX-01 | 导出 PDF（边距/纸张/页眉页脚/页面分隔/书签/大纲侧栏） | P0 | MS2 |
| EX-02 | 暗色主题导出 PDF 保留背景 | P1 | MS4 |
| EX-03 | 导出 HTML（含样式） | P0 | MS2 |
| EX-04 | 导出 HTML（无样式；数学可选 LaTeX 源码或渲染 SVG） | P1 | MS2 |
| EX-05 | 导出 Word .docx（内置写入器，Pandoc 可选） | P1 | MS4 |
| EX-06 | 导出 .odt/.rtf/.epub/.latex/Media Wiki（Pandoc 可选） | P2 | MS5 |
| EX-07 | 导入 .docx/.latex/.rst/.org/.wiki/.epub（Pandoc 可选） | P2 | MS5 |
| EX-08 | 导出为图片（文档/选区/图表/公式） | P1 | MS4 |
| EX-09 | 导出预设（格式/扩展名/模板/样式/CSS/引擎/参数/变量） | P1 | MS4 |
| EX-10 | 导出后动作（打开文件/打开目录）与"用上次设置导出" | P2 | MS5 |
| EX-11 | 打印（页面设置、页眉页脚；暗色背景不支持） | P1 | MS2 |
| EX-12 | Pandoc 检测、版本校验与安装引导 | P1 | MS4 |
| EX-13 | 导出列表自定义（新增/删除/重命名/排序/从模板添加） | P1 | MS4 |
| EX-14 | PDF 书签附加失败警告 | P2 | MS5 |

### 9.5 写作体验（WX-01 ~ WX-18）

| ID | 功能 | 优先级 | 里程碑 |
|---|---|---|---|
| WX-01 | 专注模式 Focus Mode | P1 | MS3 |
| WX-02 | 打字机模式 Typewriter Mode（含阅读速度） | P1 | MS3 |
| WX-03 | 状态栏（行/词/字符/选中统计） | P1 | MS1 |
| WX-04 | 字数统计弹层 Word Count Popover | P2 | MS5 |
| WX-05 | 内置主题（默认 + github/newsprint/night/pixyll/whitey 风格，原创） | P1 | MS3 |
| WX-06 | 明/暗主题分离 | P2 | MS4 |
| WX-07 | 自定义主题与自定义 CSS（`base.user.css` / `{theme}.user.css`） | P1 | MS3 |
| WX-08 | 字体族与字号自定义（标准/衬线/无衬线/等宽） | P1 | MS3 |
| WX-09 | 自动保存（默认 5 分钟） | P1 | MS3 |
| WX-10 | 草稿恢复 Recover Unsaved Drafts | P1 | MS3 |
| WX-11 | 版本浏览 Browse All Versions | P2 | MS5 |
| WX-12 | 编辑器浮动工具栏 | P2 | MS5 |
| WX-13 | 窗口样式（Classic/Seamless/Unibody） | P2 | MS5 |
| WX-14 | 窗口行为（置顶/全屏/缩放/Ctrl+滚轮/多显示器记忆） | P2 | MS5 |
| WX-15 | 行尾与编码（CRLF/LF、按编码重开、末尾换行） | P2 | MS5 |
| WX-16 | 拼写检查（Hunspell，多语言词典、自动纠正、学习单词） | P1 | MS3 |
| WX-17 | 大纲弹层 Outline Popover 与模式切换 | P2 | MS5 |
| WX-18 | 专注/打字机模式互斥提示 | P2 | MS5 |

### 9.6 平台集成（PI-01 ~ PI-11，以 Windows x64 为基线）

| ID | 功能 | 优先级 | 里程碑 |
|---|---|---|---|
| PI-01 | Windows x64 安装包（静默安装 `/VERYSILENT /CURRENTUSER /DIR=`） | P0 | MS1 |
| PI-02 | 文件关联与默认 Markdown 编辑器 | P1 | MS3 |
| PI-03 | 资源管理器"新建 → Markdown"右键菜单 | P2 | MS4 |
| PI-04 | 命令行/Shell 调用（`konai xxx.md`） | P1 | MS3 |
| PI-05 | 自动更新（检查更新、稳定/开发通道） | P1 | MS4 |
| PI-06 | 系统暗色模式检测与跟随 | P2 | MS5 |
| PI-07 | 第三方"Open in Typora"扩展（VS Code/Cursor） | P2 | MS5 |
| PI-08 | 图片上传第三方集成（iPic/PicGo/Picsee） | P2 | MS5 |
| PI-09 | 许可证/激活 → **合规映射：零激活、零试用、零付费、全功能默认可用、无遥测** | P1 | MS4 |
| PI-10 | 多显示器/高 DPI/缩放 | P2 | MS5 |
| PI-11 | Windows ARM 平台 → **明确不做**（基准包为 x64，超出基线） | P2 | — |

---

## 10. 合规与质量要求（贯穿所有里程碑）

1. **免费与无激活**：不实现任何 license/激活/试用/内购逻辑；状态栏、关于页、偏好中不得出现激活入口或"未激活"标记（PI-09 的合规映射）。
2. **净室**：图标、主题、字体、代码全部原创或来自合规上游；构建输入路径白名单禁止 `_work/typora_inst`；哈希黑名单与禁用串扫描每个里程碑必跑。
3. **许可证**：运行时依赖 MIT/Apache-2.0/BSD/ISC/OFL 优先；禁止 Copyleft 进入分发物；Pandoc 不打包；ffmpeg 组件处理并记录；每次打包产出 SBOM。
4. **离线**：所有渲染与导出能力默认离线可用；自动更新为可选且默认关闭（或仅在用户主动检查时访问网络）。
5. **可对照验收**：功能基线 = 矩阵 113 条；任何"做不到"的条目必须在 `stage2-architecture.spec.json` 与最终验收报告中显式记录为"超出基线/明确不做/已知例外"，不得静默省略。
6. **UI 高度相似**：布局规格见 §3.4；相似度由"并排截图人工评审 + 区域元素清单核对"验收，禁止复制视觉资产。

---

## 11. 待构建 Agent 确认的开放问题

1. 是否接受 npm workspaces（实测 pnpm 版本异常）？若坚持 pnpm，需先修复 `E:\AI-Agents-Data\Common\npm-global\pnpm` 版本回显问题。
2. 内置主题是否需要 5 套**命名不同**的原创主题（避免与 github/newsprint/night/pixyll/whitey 同名造成混淆）？建议保留同名以贴近老用户习惯，但 CSS 必须原创。
3. docx 内置写入器的保真度边界（复杂表格/脚注/数学）——建议 P1 阶段先覆盖标题/段落/列表/表格/代码/图片/行内样式，复杂结构允许降级为纯文本并提示。
4. 拼写检查（WX-16）：Hunspell 词典体积与版权（en_US 词典多为 BSD/MIT 类）需在 MS3 前确认可打包的词典来源。
5. 自动更新（PI-05）：更新源与签名策略（建议 GitHub Releases + 最小化实现，或首期仅"检查更新"提示手动下载）。
6. ARM（PI-11）：确认首期明确不做，避免范围蔓延。
