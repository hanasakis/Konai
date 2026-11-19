# Konai 1.0.0 — Release Notes

> 基线来源：**Typora 1.14.15（Windows x64 稳定版）**。Konai 为净室实现，行为对齐该基线，不含任何基准安装包资源。

## 发布内容

| 产物 | 文件名 | 大小 | SHA-256 |
| --- | --- | --- | --- |
| NSIS 安装包 | `Konai Setup 1.0.0.exe` | 131,625,976 B | `313D68EE7A0A70E4BD9834B8D9B5BB448EDD2E8693E2E349C1BF974ADE5EDA0C` |
| Portable 可执行 | `Konai-portable-1.0.0-x64.exe` | 112,963,522 B | `7DBE8D92F7776520A4B41E6B5384D44C3D4E6B5D22C05D83DED44D378B4AFDE3` |
| 免安装目录 | `win-unpacked/Konai.exe` | 249,906,688 B | `32E57DE7750B78AAB3AD480BF4D1DD12510FD68E2B2842AEACEE10E8AF62CD1D` |

校验和文件：`SHA2SUMS.txt`。

## 基线来源与识别

- 基准安装包：Typora 1.14.15 Windows x64（用户提供的只读副本）。
- 四重识别依据：安装包 PE 版本资源、`resources/package.json`、`Typora.exe` 版本资源、运行时窗口标题/状态栏（详见 `docs/stage0-1-feature-matrix.md` §0）。
- 功能矩阵 113 条（P0=20 / P1=48 / P2=45）。

## 已知差异（对照 Typora 1.14.15）

| 项 | 结果 |
| --- | --- |
| P0 | **20 / 20** 全部可用 |
| P1 | 40 / 48（暂未实现 8） |
| P2 | 20 / 45（暂未实现 25） |
| 全量 | 80 / 113 |
| UI 相似度（人工并排评审） | 85% |

主要差异：

- **安装器**：Konai 使用 **NSIS**，静默参数为 `/S /D=<dir>`；Typora 使用 Inno Setup（`/VERYSILENT /CURRENTUSER /DIR=`）。两者静默安装行为等价，参数不同。
- **GFM 解析**：Konai 使用自研块级+行内解析器（非 markdown-it 全量 GFM），覆盖表格/删除线/任务列表/自动链接。
- **表格**：未实现拖拽改列宽（工具条增删行列/对齐已实现）。
- **换行**：未实现「行尾两空格强制换行」的视觉标记。
- **导出 PDF**：`大纲侧栏` 不适用；书签以 pdf-lib 大纲实现（纸张/边距/页眉页脚/页面分隔均支持）。
- **导出 docx**：使用内置写入器，不依赖 Pandoc，保真度低于 Typora（Pandoc）；脚注/复杂表格/数学可能降级为纯文本。
- **导出 odt/rtf/epub/latex/媒体 wiki 与对应导入**：暂未实现（P2）。
- **拼写检查**：不随包分发第三方 Hunspell 词典（与基准的已知差异）。
- **自动更新**：仅「检查更新」（手动），不自动检查/下载/安装。
- **Windows ARM**：首期不做（基准为 x64）。
- **主题**：内置主题与基准同名（github / newsprint / night / pixyll / whitey），但 **CSS 为原创**，非基准主题文件。

逐条见 `docs/stage4-differences.md` 与 `docs/stage0-1-feature-matrix.md`。

## 合规声明

- **许可**：MIT（`LICENSE`）。
- **原创资源**：图标为项目自绘（`build/icon.ico`），主题 CSS 原创，UI 仅引用系统字体栈；未使用基准安装包的图标、主题资源、字体、CSS、`.jsc` 字节码或任何反编译产物。
- **净室门禁**：405 条基准文件哈希黑名单 **0 命中**；10 条禁用串 **0 命中**；构建输入不含 `_work/typora_inst`。唯一哈希命中项 `vk_swiftshader_icd.json` 属 Electron/Chromium 共享运行时组件（Typora 同为 Electron 应用），非 Typora 专有资源（见 `docs/stage4-differences.md` §5）。
- **依赖许可**：472 个依赖包中无 GPL/AGPL/LGPL；1 个传递依赖（`khroma`）license 字段缺失（见 `app/THIRD_PARTY_LICENSES.md`）。
- **无激活 / 无试用 / 无遥测 / 无内购**：全功能默认可用。

## 安装

```powershell
Konai Setup 1.0.0.exe /S /D=C:\Konai     # 静默安装
Konai-portable.cmd                          # 免安装启动
```

系统要求：Windows x64。

## 升级与迁移

从 Typora 迁移见 `docs/migration-guide.md`。
