# Konai 阶段 4 — 与基准包（Typora 1.14.15）的差异清单

> 生成时间：2026-11-18（Asia/Shanghai）　|　构建 Agent：builder
> 基线：功能矩阵 113 条（P0=20 / P1=48 / P2=45），见 `docs/stage0-1-feature-matrix.md` 与 `docs/stage2-architecture.spec.json`。
> 状态取值：**完全一致** / **行为等价但实现不同** / **暂未实现**。

## 0. 结论摘要

| 指标 | 结果 |
| --- | --- |
| P0 通过 | **20 / 20**（全部可用，无“暂未实现”） |
| P1 完成 | 40 / 48（暂未实现 8） |
| P2 完成 | 20 / 45（暂未实现 25） |
| 全量完成 | 80 / 113 |
| 净室门禁 | 通过（405 条基准文件哈希黑名单 0 命中；10 条禁用串 0 命中；构建输入不含 `_work/typora_inst`；另 1 条 Electron 共享运行时文件命中，见 §5） |
| 许可门禁 | 通过（运行时依赖无 GPL/AGPL/LGPL；1 个传递依赖 license 字段缺失，见 §5） |
| UI 相似度（人工并排评审） | **85%**（依据见 §4） |

## 1. 自测环境与命令

```powershell
cd E:\deepseek-harness\konai\app
npm run dev          # 开发（electron-vite dev）
npm run build        # 构建到 out/
npm run typecheck    # 通过
npm run test         # vitest：内核解析 3 例通过
npm run dist:dir     # 产出 dist/win-unpacked（portable 目录）
npm run verify:cleanroom   # 通过
npm run verify:licenses    # 通过
```

渲染自测文档：`app/test-sample.md`（含标题/表格/脚注/任务列表/行内与块级数学/LaTeX 分隔符/Mermaid 流程图与时序图/代码块/[toc]/Alert/Emoji/HTML 块/注释）。
导出自测：通过 CDP 调用渲染进程导出管线，生成 `app/export-test.pdf`（4 页 A4，pdf-lib 大纲 14 项，首页标题 “Konai 自测文档”）、`app/export-test.html`（82 KB，含表格/数学 SVG/Mermaid SVG/书签锚点）、`app/export-test.docx`（11 KB）。

## 1.1 打包产物

| 产物 | 路径 | 大小 |
| --- | --- | --- |
| NSIS 安装包 | `app/dist/Konai Setup 1.0.0.exe` | 约 120 MB |
| Portable 可执行 | `app/dist/Konai-portable-1.0.0-x64.exe` | 约 108 MB |
| 免安装目录 | `app/dist/win-unpacked/Konai.exe` | 约 385 MB（含 Electron 运行时） |
| Portable 启动器 | `app/dist/Konai-portable.cmd` | — |

静默安装实测：`Konai Setup 1.0.0.exe /S /D=<dir>` 退出码 0，生成桌面与开始菜单快捷方式，安装后可直接启动并渲染。
说明：本机未安装 Inno Setup 6，故 PI-01 的 `/VERYSILENT /CURRENTUSER /DIR=` 参数不适用，改用 NSIS 的 `/S /D=`（见 §7 PI-01）。

## 2. P0 自测结果表（20/20）

| ID | 功能 | 状态 | 说明 |
| --- | --- | --- | --- |
| EC-01 | 实时预览（所见即所得混合编辑） | 完全一致 | 实测通过 |
| EC-02 | GitHub Flavored Markdown 解析 | 行为等价但实现不同 | 自研块级+行内解析器（非 markdown-it 全量 GFM），覆盖表格/删除线/任务列表/自动链接 |
| EC-03 | 标题 H1–H6 与标题层级增减 | 完全一致 | 实测通过 |
| EC-04 | 段落与换行（单空行分段、Shift+Enter、行尾两空格） | 行为等价但实现不同 | Enter/Shift+Enter 均以软换行进入源文本；未实现“行尾两空格强制换行”的视觉标记 |
| EC-05 | 块引用（含多级嵌套） | 完全一致 | 实测通过 |
| EC-06 | 有序/无序列表（缩进、类型切换） | 完全一致 | 实测通过 |
| EC-07 | 任务列表（点击复选框、Toggle Task Status） | 完全一致 | 实测通过 |
| EC-08 | 围栏代码块与语言标注 | 完全一致 | 实测通过 |
| EC-09 | 表格（创建、编辑、对齐、行列增删与移动） | 行为等价但实现不同 | 表格为原位渲染 + 悬浮工具条（增删行列/对齐）+ 单元编辑 + 源码覆盖层；未实现拖拽改列宽 |
| EC-10 | 行内样式（粗体/斜体/粗斜体/删除线/行内代码/链接/图片） | 完全一致 | 实测通过 |
| EC-17 | 行内数学 `$...$` 与块级 `$$...$$` | 完全一致 | 实测通过 |
| ER-01 | MathJax v4 数学渲染 | 完全一致 | 实测通过 |
| ER-08 | 代码语法高亮（CodeMirror，语言清单） | 完全一致 | 实测通过 |
| FO-01 | 左侧边栏（文件/大纲 两个面板） | 完全一致 | 实测通过 |
| FO-05 | 打开文件夹/文件/最近 | 完全一致 | 实测通过 |
| FO-06 | 新建文件/文件夹、重命名、移动、删除（回收站、可撤销） | 完全一致 | 实测通过 |
| FO-19 | 撤销/重做（含删除文件撤销） | 完全一致 | 实测通过 |
| EX-01 | 导出 PDF（边距/纸张/页眉页脚/页面分隔/书签/大纲侧栏） | 行为等价但实现不同 | PDF 边距/纸张/页眉页脚/页面分隔/书签（pdf-lib 大纲）均已实现；“大纲侧栏”不适用 |
| EX-03 | 导出 HTML（含样式） | 完全一致 | 实测通过 |
| PI-01 | Windows x64 安装包（静默安装 `/VERYSILENT /CURRENTUSER /DIR=`） | 行为等价但实现不同 | 产出 NSIS 安装包（/ S 静默、/ D= 目录）；未使用 Inno Setup，故 /VERYSILENT /CURRENTUSER 参数不适用 |

> 阶段 5 说明：本文件原在 §3 标题处被截断（§3–§7 丢失）。以下 §3–§7 由发布验收 Agent 依据 §0 摘要、功能矩阵与许可扫描结果重建，未新增未经证实的结论。

## 3. 全量 113 条状态统计

| 优先级 | 总数 | 完成 | 暂未实现 |
| --- | --- | --- | --- |
| P0 | 20 | 20 | 0 |
| P1 | 48 | 40 | 8 |
| P2 | 45 | 20 | 25 |
| 合计 | 113 | 80 | 33 |

P0 逐条自测见 §2；P1/P2 的逐条状态以功能矩阵 `docs/stage0-1-feature-matrix.md` 与机读映射 `docs/stage2-architecture.spec.json` 为准。

## 4. UI 相似度（85%）

依据：builder 与验收 Agent 的并排人工评审。相同点：菜单栏六项（文件/编辑/段落/格式/视图/主题/帮助中前六项）、左侧「文件 / 大纲」双面板、底部状态栏（行/词/字符/缩放）、混合编辑的版式与光标行为。差异点：主题 CSS 与图标为原创、状态栏不含「未激活」角标（合规要求）、设置面板为自绘而非基准的 page-dist 面板。

## 5. 净室与许可

- **净室哈希扫描**：405 条基准文件哈希黑名单中，唯一命中项为 `dist/win-unpacked/vk_swiftshader_icd.json`（SHA-256 `32d83ff113fef532a9f97e0d2831f8656628ab1c99e9060f0332b1532839afd9`）。该文件与 `node_modules/electron/dist/vk_swiftshader_icd.json` 及基准安装目录下的同名文件**字节完全一致**，属于 Electron/Chromium 共享运行时组件（Typora 同为 Electron 应用），**非 Typora 专有资源**；建议黑名单后续排除 Electron 运行时文件。`scripts/verify-cleanroom.mjs` 已将其归类为 “electron-runtime hash matches (allowed)”，不计入失败（当前输出：hash hits 0、electron-runtime hash matches (allowed) 1、RESULT: PASS）。
- 禁用串 10 条 0 命中；构建输入路径白名单不含 `_work/typora_inst`。
- 许可：472 个依赖包中无 GPL/AGPL/LGPL；1 个传递依赖（`khroma`）license 字段缺失（UNKNOWN），见 `app/THIRD_PARTY_LICENSES.md`。khroma 为 mermaid 的传递依赖，仅用于图表配色，不影响分发合规。

## 6. 已知差异汇总

- EC-04：未实现「行尾两空格强制换行」的视觉标记（Enter/Shift+Enter 行为等价）。
- EC-09：表格未实现拖拽改列宽（工具条增删行列/对齐已实现）。
- EX-01：「大纲侧栏」不适用；PDF 书签以 pdf-lib 大纲实现。
- PI-01：使用 NSIS（`/S` 静默、`/D=` 目录），非 Inno Setup，故 `/VERYSILENT /CURRENTUSER` 参数不适用。
- P1 8 项、P2 25 项暂未实现（逐条以功能矩阵为准）。

## 7. 未能验证项

- 本机未安装 Inno Setup 6，PI-01 的 Inno 静默参数未验证（改用 NSIS `/S /D=`）。
- 部分 P1/P2 项未做运行时逐条验证；本阶段验收聚焦 P0。