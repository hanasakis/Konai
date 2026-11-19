# Typora → Konai 迁移指南

> 目标：让 Typora 1.14.15 老用户在不看文档的情况下，用 Konai 完成日常写作。基线行为以 `docs/stage0-1-feature-matrix.md` 为准；快捷键以 **Konai 实际菜单/键位为准**（下表已核对源码）。

## 1. 快捷键对照

Konai 列取自 `app/src/renderer/components/MenuBar.tsx` 与 `app/src/renderer/editor/EditorView.ts`（已核对）；Typora 列仅填写本地文档/功能矩阵可核实的条目，其余标注「以 Typora 官方 Shortcut Keys 文档为准」。

| 操作 | Typora 1.14.15 | Konai 1.0.0 | 备注 |
| --- | --- | --- | --- |
| 新建 | （以官方文档为准） | `Ctrl+N` | 菜单「文件 → 新建」 |
| 新建标签页 | （以官方文档为准） | `Ctrl+T` | Konai 支持多标签 |
| 新建窗口 | （以官方文档为准） | `Ctrl+Shift+N` | — |
| 打开文件 | （以官方文档为准） | `Ctrl+O` | 原生对话框 |
| 打开文件夹 | （以官方文档为准） | `Ctrl+Shift+O` | 文件树 |
| 保存 | （以官方文档为准） | `Ctrl+S` / `Ctrl+Enter` | — |
| 另存为 | （以官方文档为准） | `Ctrl+Shift+S` | 注意与「删除线」菜单标注冲突，见 §5 |
| 关闭标签页 | （以官方文档为准） | `Ctrl+W` | — |
| 恢复关闭的文件 | （以官方文档为准） | `Ctrl+Shift+T` | — |
| 撤销 / 重做 | （以官方文档为准） | `Ctrl+Z` / `Ctrl+Y` | 含删除文件撤销 |
| 查找 / 替换 | （以官方文档为准） | `Ctrl+F` / `Ctrl+H` | — |
| 快速打开 Quick Open | `Ctrl+P`（功能矩阵 FO-08） | `Ctrl+P`（编辑器键位） | 菜单「打印」也标注 `Ctrl+P`，存在冲突，见 §5 |
| 源码模式切换 | `Ctrl+/`（功能矩阵 EC-30） | `Ctrl+/` | 切换后滚动位置保留 |
| 标题 1–6 | （以官方文档为准） | `Alt+1` … `Alt+6` | 菜单「段落」 |
| 增加 / 减少缩进 | （以官方文档为准） | `Tab` / `Shift+Tab` | — |
| 行 / 段落上下移动 | `Alt+↑` / `Alt+↓`（功能矩阵 EC-32） | `Alt+↑` / `Alt+↓` | 一致 |
| 粗体 / 斜体 / 行内代码 / 链接 | （以官方文档为准） | `Ctrl+B` / `Ctrl+I` / `Ctrl+E` / `Ctrl+K` | 编辑器键位 |
| 全屏 | （以官方文档为准） | `F11` | — |
| 放大 / 缩小 / 实际大小 | （以官方文档为准） | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | 状态栏也有缩放控件 |
| 自动保存 | 默认 5 分钟（功能矩阵 WX-09） | 默认 5 分钟 | 见 §2 |

## 2. 设置项位置对照

| 设置 | Typora 1.14.15 | Konai 1.0.0 |
| --- | --- | --- |
| 偏好入口 | 菜单 `File → Preference`（本机离线未核对快捷键） | **当前无菜单入口**；偏好面板组件已实现（`PreferencesDialog`）但未在菜单暴露。设置直接编辑配置文件 |
| 配置文件 | `conf.user.json`（Preference → Open Advanced Settings） | `%APPDATA%\Konai\conf\conf.user.json`（默认值见 `conf.default.json`） |
| 自动保存间隔 | `conf.user.json` → `autoSaveTimer`（分钟，默认 5） | 同键 `autoSaveTimer`（默认 5） |
| 主题 | 菜单 `Theme`；主题文件夹经 Preference → Open Theme Folder | 菜单 `主题`（GitHub/Newsprint/Night/Pixyll/Whitey）；`主题 → 打开主题文件夹` |
| 自定义 CSS | 主题文件夹下 `base.user.css` / `{theme}.user.css` | 同名机制：`base.user.css` / `{theme}.user.css`（菜单「打开自定义 CSS 说明」） |
| 快捷键自定义 | `conf.user.json` → `keyBinding`（键为菜单项文本） | **暂未实现** `keyBinding` 覆盖（配置项已预留） |
| 隐藏文件 / 全部文件 / 过滤 | Preference 中开关 | 配置文件 `showHiddenFiles` / `showAllFiles` / `fileFilter` |
| 拼写检查 | 内置 Hunspell 词典 | 不随包分发词典（可选下载未实现） |

> 说明：Konai 的偏好设置目前以配置文件为准，修改后重启生效（部分项即时生效）。

## 3. 导出行为差异

| 格式 | Typora 1.14.15 | Konai 1.0.0 | 差异 |
| --- | --- | --- | --- |
| PDF | 打印管线，支持纸张/边距/页眉页脚/页面分隔/书签/大纲侧栏 | `printToPDF` + pdf-lib 书签后处理；纸张/边距/页眉页脚/页面分隔/书签 | 「大纲侧栏」不适用；书签结构由 Konai 生成 |
| HTML（含样式） | 支持 | 支持 | 一致（不依赖 Pandoc） |
| HTML（无样式） | 支持 | 支持 | 数学可选渲染 SVG / LaTeX 源码 |
| Word `.docx` | 依赖 Pandoc ≥ 2.0 | 内置写入器（`docx`） | **保真度低于 Pandoc**：脚注/复杂表格/数学可能降级为纯文本 |
| odt / rtf / epub / latex / Media Wiki | 依赖 Pandoc | **暂未实现** | P2 |
| 导入 docx/latex/rst/org/wiki/epub | 依赖 Pandoc | **暂未实现** | P2 |
| 图片 | 复制为图片/另存为 | 支持（`图片…` 导出） | — |
| 导出预设/模板 | 支持 | **暂未实现** | P1/P2 |

## 4. 主题迁移说明

- Konai 内置主题与 Typora **同名**：`github` / `newsprint` / `night` / `pixyll` / `whitey`（外加默认主题）。
- 但 Konai 的主题 **CSS 为原创**（净室要求），**不是** Typora 的主题文件；因此**外观不完全一致**，但命名与整体定位对应，便于老用户选择。
- 从 Typora 迁移自定义样式：
  1. 打开 Konai「主题 → 打开主题文件夹」；
  2. 将你在 Typora 中的自定义规则粘贴到 `base.user.css`（对所有主题生效）或 `{theme}.user.css`（仅对某主题生效）；
  3. 不要直接复制 Typora 的主题 `.css` 文件或随附字体（净室合规禁止）。
- Typora 主题文件夹的第三方主题（来自 Theme Gallery）如仅使用标准 CSS 且不含 Typora 私有资源，可自行评估后迁移；Konai 不打包任何 Typora 主题资源。

## 5. 已知快捷键/入口问题（迁移注意）

- `Ctrl+P`：编辑器键位为「快速打开」，而菜单「文件 → 打印」也标注 `Ctrl+P`，存在冲突。
- `Ctrl+Shift+S`：菜单「另存为」与「格式 → 删除线」都标注 `Ctrl+Shift+S`，存在冲突。
- 偏好设置面板已实现但未在菜单暴露入口，暂以配置文件修改。
- `keyBinding` 自定义尚未实现。

> 以上冲突/缺口已记入 `docs/stage5-acceptance-report.md` 的「未能验证/已知问题」。
