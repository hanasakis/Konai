# Konai 决策记录（Team Lead）

本文件记录 Team Lead 对各阶段产出的验收结论与对开放问题的裁决，供后续子 Agent 执行。

## 阶段 0+1 验收（信息调研 Agent）
**结论：通过。** 版本锚点 = Typora 1.14.15（Windows x64 稳定版），四重识别依据经独立复核一致（安装包 PE 版本资源、`resources/package.json`、`Typora.exe` 版本资源、运行时窗口标题/状态栏）。功能矩阵 113 条（P0=20 / P1=48 / P2=45），六维 36/15/19/14/18/11，与报告一致；每条均有可客观判断的验收标准；含“网络流传但未包含”背景节与合规说明。产出：`konai/docs/stage0-1-feature-matrix.md`。

## 阶段 2 验收（架构规划 Agent）
**结论：通过。** 推荐栈 Electron + TypeScript + Vite + CodeMirror 6（Lezer 增量树）+ MathJax 4 + Mermaid 11 + pdf-lib + electron-builder/Inno Setup；候选 3 个含加权对比；8 个模块覆盖全部要求；数据流含块级增量解析、光标保持、三层撤销；5 个里程碑可演示且映射到矩阵条目；8 项风险均有缓解。机读映射 `konai/docs/stage2-architecture.spec.json` 经 Node UTF-8 校验为合法 JSON，113 条与矩阵逐条一致。产出：`konai/docs/stage2-architecture.md`。

### 对架构方案 §11 开放问题的裁决
1. **npm workspaces：接受。** 采用 npm workspaces（npm 11.11.0 可用，pnpm 版本回显异常），锁定 lockfile 并 save-exact；不投入成本修复 pnpm。
2. **内置主题命名：保留同名**（github / newsprint / night / pixyll / whitey）以降低老用户迁移成本；但 CSS、配色、字体搭配必须原创，禁止复制基准包的主题 CSS 与随附字体文件。交付时需在差异清单注明“同名不同源”。
3. **docx 保真度边界：** 内置写入器（npm `docx`）覆盖标题/段落/列表/表格/代码/图片/行内样式；脚注、复杂表格、数学等允许降级为纯文本并在导出后提示。不打包 Pandoc（规避 Copyleft）；在差异清单中如实标注与 Typora（依赖 Pandoc）的保真度差异。
4. **拼写检查词典：不随安装包分发第三方 Hunspell 词典。** 实现为可选下载（设置项或首次启动提示），登记词典来源与许可证；无词典时优雅禁用该功能。已记为与基准包的已知差异。
5. **自动更新（PI-05）：仅做用户主动「检查更新」**（读取 GitHub Releases，默认不自动检查、不自动下载/安装）。该条目标记为“部分满足”，写入差异清单。
6. **Windows ARM（PI-11）：首期明确不做**，记为超出基线。

## 贯穿性硬性约束（再次确认，适用于阶段 3/4/5）
- 完全免费：零激活、零试用、零付费、零遥测；全功能默认可用。
- 净室：不得复用基准安装包的图标、主题资源、字体、jsc 字节码或任何反编译产物；构建输入路径白名单排除 `_work/typora_inst`。
- 逆向仅用于理解行为与机制，不得绕过授权、破解或再分发原程序资源；下游只接收“行为规格 + 约束清单”，不接收原始反编译内容。
