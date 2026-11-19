# Konai

一个**完全免费、零激活、零遥测**的 Windows x64 Markdown 编辑器。净室实现，行为对齐基准 **Typora 1.14.15（Windows x64）**。

- 安装包：`Konai Setup 1.0.0.exe`（NSIS，约 120 MB）
- 免安装：`Konai-portable.cmd` 或 `win-unpacked\Konai.exe`
- 源码：`app/`（Electron 45 + TypeScript + Vite + CodeMirror 6 + MathJax 4 + Mermaid 11）
- 文档：`docs/`；资产来源：`ASSET_PROVENANCE.md`；许可：`LICENSE`（MIT）

## 功能对比（基线 Typora 1.14.15 / Windows x64）

| 维度 | Typora 1.14.15 | Konai 1.0.0 | 说明 |
| --- | --- | --- | --- |
| 实时预览（混合编辑） | 支持 | **支持** | 输入即渲染，行为一致 |
| GFM 表格 / 删除线 / 任务列表 | 支持 | **支持** | 自研解析器，行为等价 |
| 标题 / 段落 / 引用 / 列表 | 支持 | **支持** | H1–H6、多级引用、有序/无序、缩进 |
| 行内样式 | 支持 | **支持** | 粗体/斜体/粗斜体/删除线/行内代码/链接/图片 |
| 围栏代码块 + 语法高亮 | 支持 | **支持** | CodeMirror 6 + highlight.js |
| 数学（MathJax v4） | 支持 | **支持** | 行内 \$...\$、块级 \$\$...\$\$ |
| Mermaid 11.13 | 支持 | **支持** | 流程图/时序图等 |
| 侧边栏（文件 / 大纲） | 支持 | **支持** | 双面板 |
| 打开文件夹 / 文件 / 最近 | 支持 | **支持** | 文件树 + 最近列表 |
| 新建 / 重命名 / 移动 / 删除 | 支持 | **支持** | 回收站 + 可撤销 |
| 撤销 / 重做 | 支持 | **支持** | 含删除文件撤销 |
| 导出 PDF | 支持 | **支持** | 纸张/边距/页眉页脚/页面分隔/书签（pdf-lib） |
| 导出 HTML（含样式） | 支持 | **支持** | 不依赖 Pandoc |
| 导出 Word (.docx) | 支持（Pandoc） | **支持（内置写入器）** | 保真度边界见差异清单 |
| 内置主题 | github/newsprint/night/pixyll/whitey | **同名，CSS 原创** | 详见迁移指南 |
| 激活 / 试用 | 需激活（一次性买断） | **无激活、无试用、无遥测** | 全功能默认可用 |
| Windows x64 安装包 | Inno Setup | **NSIS**（`/S` 静默、`/D=` 目录） | 静默参数不同，见差异清单 |
| 自动更新 | 自动检查 | **仅手动「检查更新」** | 见差异清单 |

**完成度**：P0 **20 / 20**；P1 **40 / 48**；P2 **20 / 45**（合计 80 / 113）。逐条见 `docs/stage0-1-feature-matrix.md` 与 `docs/stage4-differences.md`。

## 安装

1. 下载 Release 中的 `Konai Setup 1.0.0.exe`，双击安装；或静默安装：
   ```
   Konai Setup 1.0.0.exe /S /D=C:\Konai
   ```
2. 免安装：解压 `Konai-portable-1.0.0-x64.exe` 所在目录，运行 `Konai-portable.cmd`（或 `win-unpacked\Konai.exe`）。
3. 校验：`SHA2SUMS.txt`（SHA-256）。

## 构建

见 [BUILDING.md](BUILDING.md)。

## 从 Typora 迁移

见 [docs/migration-guide.md](docs/migration-guide.md)。

## 合规声明

- 本项目为 **MIT** 许可的净室实现。
- 未使用基准安装包的**图标、主题资源、字体、CSS、.jsc 字节码或任何反编译产物**；主题同名但 CSS 原创，图标为项目自绘。
- 净室门禁：405 条基准文件哈希黑名单 **0 命中**，10 条禁用串 **0 命中**；唯一哈希命中项 `vk_swiftshader_icd.json` 属 Electron/Chromium 共享运行时组件，见 `docs/stage4-differences.md` §5。
- 运行时依赖无 GPL/AGPL/LGPL（`app/THIRD_PARTY_LICENSES.md`）。
- 不含激活、试用倒计时、内购、遥测。
