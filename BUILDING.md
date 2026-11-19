# 构建说明

## 环境要求

- Windows x64（开发/打包）；其他平台可运行 `npm run dev` 但打包目标为 Windows。
- Node.js >= 20（实测 Node 24）。
- npm >= 11（实测 npm 11.11.0）。
- 无需 Pandoc：HTML 导出走内置渲染，docx 导出走内置写入器。

## 步骤

```powershell
cd app
npm install          # 依赖安装（.npmrc 已配置 electron 镜像）
npm run dev          # 开发（electron-vite dev，热更新）
npm run build        # 构建到 out/
npm run typecheck    # TypeScript 类型检查
npm run test         # vitest 内核解析测试
npm run verify:cleanroom   # 净室门禁：哈希黑名单 + 禁用串 + 构建输入白名单
npm run verify:licenses    # 生成 app/THIRD_PARTY_LICENSES.md
```

## 打包

```powershell
npm run dist:dir     # 产出 dist/win-unpacked（免安装目录）
node scripts/make-portable.mjs   # 生成 dist/Konai-portable.cmd 启动器
npm run dist         # 产出 NSIS 安装包 + portable（dist/）
```

产物：

| 产物 | 路径 | 说明 |
| --- | --- | --- |
| NSIS 安装包 | `app/dist/Konai Setup 1.0.0.exe` | 静默 `/S /D=<dir>` |
| Portable 可执行 | `app/dist/Konai-portable-1.0.0-x64.exe` | — |
| 免安装目录 | `app/dist/win-unpacked/Konai.exe` | 含 Electron 运行时 |
| Portable 启动器 | `app/dist/Konai-portable.cmd` | — |

## 净室与许可门禁

```powershell
npm run verify:cleanroom   # 期望：hash hits 0 / pattern hits 0 / forbidden path hits 0 / RESULT: PASS
npm run verify:licenses    # 期望：copyleft matches 0
```

黑名单与禁用串位于 `cleanroom/`（`typora-file-hashes.txt`、`FORBIDDEN_PATTERNS.txt`）。
