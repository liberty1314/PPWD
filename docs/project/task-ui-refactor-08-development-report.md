# TASK-UIR-08 开发记录：移除 Vue、统一依赖与构建收口

## 结论

desktop 与 extension 的默认 UI 入口已固定为 React，Vue SFC、Vue/Pinia/Element Plus/Vue Router 运行时、Vue 插件和 `vue-tsc` 均已移除。两端现使用 pnpm 锁文件与 `tsc` 类型检查；桌面 main/preload/renderer、扩展 build/package 及根级扩展构建入口通过。

macOS arm64 `.app` 与 DMG 已通过隔离产物验证：将 electron-builder 下载缓存指向全新临时目录后，默认 `unpack-electron` 成功，app、项目 `after-mac-build` 后处理与 DMG 内容检查均通过。当前用户缓存中的旧 Electron ZIP 带有异常偏移，默认缓存路径解包会缺少 `Contents/MacOS/Electron` 并在重命名时报 `ENOENT`；旧缓存保留未动。Windows installer 仍待验证。

本次 macOS 产物命令：`pnpm exec electron-builder --mac --publish never --config.directories.output=/tmp/bearpassword-ui-refactor-08-fresh-dmg-check --config.electronDownload.cache=/tmp/bearpassword-ui-refactor-08-electron-download-cache`。`after-mac-build.mjs` 在临时副本中执行，避免清理仓库现有 `release/` 产物。

## 实施范围

- 移除 desktop 的 Vue renderer、Vue Router、Pinia、Element Plus 与 Vue icon 组件；移除 extension 的 Vue popup SFC、Pinia stores、Vue runtime 与相关组件。
- 删除 `mainVue`、旧 router、Vue-only composables、消息框 helper、popup legacy i18n/stores 及 `.vue` module declarations；两个 HTML 入口固定指向 React。
- desktop 原 Pinia-backed auth/security/auto-lock/settings stores 改由框架无关的 `createStateStore` 驱动；React renderer 通过 `useSyncExternalStore` 订阅。VUK 仍只保留在原内存安全 store，store 没有新增持久化。
- 用 React 插件配置 Electron renderer 与 extension Vite；两端 `typecheck` 改用 `tsc --noEmit`，build 前运行 typecheck。extension package 和根 `scripts/build-all.mjs --extension` 使用 pnpm。
- 移除两个 npm `package-lock.json`，刷新 desktop pnpm lockfile 并为 extension 生成 pnpm lockfile。
- 新增框架无关 store 状态展开、派生值与订阅取消测试。

## 验证

| 检查 | 结果 |
| --- | --- |
| desktop `pnpm run typecheck` | 通过 |
| desktop `pnpm run build` | 通过；main、preload、React renderer 产物正常 |
| desktop 认证/安全/备份/主题测试 | 15 项通过（phone token 9、encrypted backup 3、theme migration 3） |
| desktop `pnpm run test:reactive-store` | 1 项通过 |
| extension `pnpm run typecheck` | 通过 |
| extension `pnpm run package` | 通过；production build 与 ZIP 生成成功 |
| extension locale tests | 3 项通过 |
| 根目录 `pnpm run build:extension` | 通过；聚合脚本调用 pnpm 并生成扩展 ZIP |
| 旧 UI 与依赖引用搜索 | 通过；两端源码没有 `.vue`、Vue/Pinia/Element Plus/Vue Router/plugin/vue-tsc 引用 |
| main/preload/background/content bundle | 通过；没有 React/Vue UI runtime 泄漏 |
| macOS arm64 app / DMG | 通过；使用新下载的 runtime 经默认 `unpack-electron` 打包，`Info.plist`、arm64 executable、`app.asar`、四个 extraResources 图标通过检查；后处理脚本在临时副本中成功注入 `安装说明.txt`，挂载 DMG 确认 app、Applications 链接及说明文件齐全 |
| macOS 旧 Electron 缓存路径 | 失败；旧缓存 ZIP 的 `unzip` 检查报告约 349 MB 异常偏移，解包输出缺少 Electron executable，`createMacApp` 重命名时报 `ENOENT`；全新隔离下载缓存的标准 `unpack-electron` 路径及显式本地 dist 路径均通过 |
| `git diff --check` 和暂存区检查 | 通过 |

renderer 构建仍有既存 `desktopThemeAdapter` 动态与静态导入提示；扩展构建提示图标重复输出覆盖。它们未阻止构建。Node strip-types 测试有未声明 ESM package type 的性能提示。

## TASK-UIR-09 待办

- 在 Windows CI 或打包环境验证 Windows installer 与资源清单。
- 刷新当前机器损坏的 Electron 33.4.11 macOS arm64 缓存 ZIP 后，可重试标准 `pnpm run build:mac`；本次已用隔离下载缓存完成标准 `unpack-electron` app/DMG 打包及资源验证。
- 安装验证最终扩展 ZIP，并继续执行 Edge、wake protocol 冷启动、TOTP/快速保存与浏览器重启 session 旅程。
- 执行真人桌面与扩展 UI 验收；当前自动化构建和 ego lite 检查不视为真人签认。
