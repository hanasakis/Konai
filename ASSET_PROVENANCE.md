# Konai 资产来源与许可证登记（ASSET_PROVENANCE）

> 生成时间：2026-11-18（Asia/Shanghai）　|　维护者：builder
> 原则：构建输入白名单不含 `_work/typora_inst`；不复制基准包的任何图标、主题、字体、CSS、jsc 或反编译产物。

## 1. 应用图标 / 视觉资源

| 资产 | 来源 | 作者 | 许可证 | 说明 |
| --- | --- | --- | --- | --- |
| `app/build/icon.png` / `icon.ico` | 项目自绘（`scripts/build-icons.mjs` 用 Pillow 生成） | Konai Project | MIT（项目自有） | 圆角方形渐变底 + 白色 K，原创 |
| 文件树/菜单/状态栏等 UI 图标 | Unicode 符号或 CSS 绘制 | Konai Project | MIT | 未使用图标字体 |

## 2. 主题

| 主题 | 文件 | 来源 | 许可证 | 说明 |
| --- | --- | --- | --- | --- |
| GitHub | `app/src/renderer/theme/themes/github.css` | 原创 | MIT | 与基准同名不同源 |
| Newsprint | `app/src/renderer/theme/themes/newsprint.css` | 原创 | MIT | 同名不同源 |
| Night | `app/src/renderer/theme/themes/night.css` | 原创 | MIT | 同名不同源 |
| Pixyll | `app/src/renderer/theme/themes/pixyll.css` | 原创 | MIT | 同名不同源 |
| Whitey | `app/src/renderer/theme/themes/whitey.css` | 原创 | MIT | 同名不同源 |
| 基础变量/排版 | `app/src/renderer/theme/base.css` | 原创 | MIT | — |

## 3. 字体

| 类别 | 处理方式 | 许可证 | 说明 |
| --- | --- | --- | --- |
| UI 正文 | 仅引用系统字体栈（Segoe UI / 微软雅黑 / Georgia / 系统 sans/serif） | 系统字体授权 | 不打包字体文件 |
| 等宽 | 引用 Consolas / Cascadia Code / JetBrains Mono | 各自授权 | 不打包 |
| MathJax 字体 | MathJax v4 组件内置（data: URI 内嵌于 tex-svg.js） | Apache-2.0 | 随 MathJax 分发 |
| Mermaid | 不打包字体，继承编辑器字体 | MIT | — |

## 4. 运行时第三方库（打包进分发物）

| 包 | 版本 | 许可证 | 用途 |
| --- | --- | --- | --- |
| electron | 45.3.4 | MIT | 宿主 |
| react / react-dom | 19.1.1 | MIT | UI |
| @codemirror/{state,view,commands,language,search,autocomplete,lang-markdown} | 6.x | MIT | 编辑器内核 |
| @lezer/{markdown,common,highlight,lr} | 1.x | MIT | 增量解析/高亮 |
| markdown-it | 15.0.3 | MIT | 导出解析 |
| mathjax | 4.1.3 | Apache-2.0 | 数学渲染（本地 vendor 副本） |
| mermaid | 11.13.0 | MIT | 图表渲染 |
| highlight.js | 11.12.0 | BSD-3-Clause | 代码高亮 |
| pdf-lib | 1.17.1 | MIT | PDF 书签后处理 |
| docx | 9.15.4 | MIT | docx 导出 |
| chokidar | 4.0.3 | MIT | 文件监听 |
| zustand | 5.1.0 | MIT | 渲染进程状态 |
| zod | 4.6.7 | MIT | 校验 |
| d3（mermaid 依赖） | 7.x | ISC / BSD-3 | 图表布局 |

## 5. 构建期依赖（不打包）

electron-vite / vite / typescript / electron-builder / vitest / @types/* / @vitejs/plugin-react —— MIT/Apache-2.0，仅用于构建。

## 6. 明确不打包 / 禁止使用

- Pandoc（GPL-2.0+）：不依赖、不链接、不分发；docx 导出使用内置 docx 写入器。
- 基准包 themes/*.css、style/*.woff*、assets/icon/*、app.asar/lib.asar 内任何资源：禁止复用。
- 任何 .jsc 字节码或反编译产物：禁止。
- Copyleft（GPL/AGPL/LGPL）运行时依赖：禁止（verify:licenses 门禁）。

## 7. 验证

```powershell
cd E:\deepseek-harness\konai\app
npm run verify:cleanroom   # 哈希黑名单 405 条 + 禁用串 10 条，0 命中
npm run verify:licenses    # 运行时依赖无 Copyleft
```

完整传递依赖清单见 `app/THIRD_PARTY_LICENSES.md`（由 scripts/vendor-licenses.mjs 生成）。
