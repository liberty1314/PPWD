# TASK-UIR-09 开发记录：全量质量门禁、人工验收与发布准备

## 结论

本仓库未发现 desktop/extension E2E runner 或 E2E 命令；本轮完成了现有类型检查、生产构建、单元/纯逻辑测试、依赖审计、扩展打包和 macOS arm64 app/DMG 资源检查。**TASK-UIR-09 门禁未通过，不能发布**：E2E 自动化覆盖缺失，项目维护者尚未签认桌面与扩展真实 UI 旅程，Edge 和 Windows installer 尚未在对应环境验证。

ego lite 中 BearPassword `26.9.9` 扩展已启用。检查时 Service Worker 起初无效，重新加载后恢复有效；popup 可打开，但显示“未连接”，提示先启动桌面端。该次检查没有启动或认证桌面应用，也没有访问保险库条目、密码或恢复密钥，因此不构成认证、密码库或自动填充验收。

## 环境与版本

| 项目 | 记录 |
| --- | --- |
| 日期/平台 | 2026-11-08，macOS arm64 |
| Node.js / pnpm | Node.js `v26.12.0` / pnpm `12.16.1` |
| 桌面/扩展版本 | `26.9.9` / `26.9.9` |
| Electron | `33.4.11` |
| React Router | `7.18.2` |
| Ego Lite | TaskSpace `19`；扩展重载后 Service Worker 有效，popup 显示桌面未连接 |

## 自动化与构建证据

| 检查 | 命令/证据 | 结果 |
| --- | --- | --- |
| Desktop 类型检查和生产构建 | `cd ppwd-desktop && pnpm run typecheck && pnpm run build` | 通过；main、preload、renderer 均生成 |
| Desktop 纯逻辑/状态测试 | `pnpm run test:phone-token`、`pnpm run test:encrypted-backup`、`pnpm run test:theme-migration`、`pnpm run test:reactive-store` | 17 项通过，0 失败 |
| Extension 类型检查、生产构建和打包 | `cd ppwd-extension && pnpm run typecheck && pnpm run package` | 通过 |
| Extension locale 测试 | `pnpm run test:locale` | 3 项通过，0 失败 |
| E2E 自动化 | 搜索两端 package scripts 与源码中的 Playwright/Cypress/E2E runner | 未发现已配置的 E2E runner/命令；核心用户旅程仍需真人验收，自动化 E2E 是待补质量缺口 |
| 根级扩展构建入口 | `pnpm run build:extension` | 通过；根脚本调用 pnpm 并生成扩展 ZIP |
| Extension ZIP 归档 | `unzip -t release/BearPassword-Extension.zip`；归档清单 37 项（含目录） | 所列文件均通过压缩完整性检查；MV3 manifest、service worker、popup、wake 入口存在 |
| Desktop 生产依赖审计 | `cd ppwd-desktop && pnpm audit --prod` | `No known vulnerabilities found` |
| Extension 生产依赖审计 | `cd ppwd-extension && pnpm audit --prod` | `No known vulnerabilities found` |
| 补丁空白检查 | `git diff --check` | 通过 |

测试期间有 Node `MODULE_TYPELESS_PACKAGE_JSON` 性能提示；desktop renderer 有 `desktopThemeAdapter` 动态/静态导入提示；extension 构建有四个图标重复输出提示。均未导致本轮构建或测试失败，发布前仍应评估扩展图标重复输出的配置来源。

## 验收期间发现并修复的问题

维护者报告桌面 UI 空白，错误为 `app.subscribe is not a function`。根因是 `useStoreSnapshot()` 把 `useSyncExternalStore()` 返回的版本快照（数字）错误地当作业务 store 返回；`useDesktopLocale()` 因此在 effect 中对数字调用 `subscribe`，其他页面也会读到错误的 store 状态。

已修复为：继续用 store `version` 触发 React 重渲染，同时将实际 store 实例返回给组件。新增 SSR 回归测试覆盖真实 hook 调用链：修复前断言失败（实际为 `0`），修复后通过，并验证返回值身份、订阅方法和状态值。维护者尚未在 Electron 窗口确认热更新后的视觉恢复；请重新载入当前开发窗口后补记人工验收表。代码修复不替代 TASK-UIR-09 其余真人旅程。

维护者随后反馈解锁页与原型不一致且布局错乱。检查发现认证路由的 `.react-gate*` 样式缺失，导致品牌 SVG 按原始尺寸显示、表单和页脚退化为文档流。已补上原型对应的左侧本地安全说明、右侧居中认证区、品牌标记、步骤指示和窄屏单栏布局；保留现有生物识别/动态码/恢复流程。浏览器中以实际 renderer CSS 验证了桌面分栏与 370px 表单宽度；移动断点的剩余高度分配问题也已修正。此结构预览不代替在 Electron 实际认证页上的人工确认。

## macOS arm64 产物

使用独立下载缓存和 `/tmp` 输出目录执行当前 `26.9.9` desktop 构建：

```sh
cd ppwd-desktop
pnpm exec electron-builder --mac --publish never \
  --config.directories.output=/tmp/bearpassword-ui-refactor-09-mac-output \
  --config.electronDownload.cache=/tmp/bearpassword-ui-refactor-09-electron-cache
```

生成 `/tmp/bearpassword-ui-refactor-09-mac-output/BearPassword.dmg`，再在隔离临时目录运行项目后处理并生成最终验证件 `/tmp/bearpassword-ui-refactor-09-postprocess/release/BearPassword.dmg`。检查确认 `Info.plist` 的 bundle id 为 `com.bear.password`、版本为 `26.9.9`、URL scheme 为 `bearpassword`；app executable 为 arm64 Mach-O；`app.asar` 与 icns/ico/png/tray 图标存在；最终 DMG 校验并可只读挂载，内含 BearPassword.app、Applications 链接和 `安装说明.txt`。electron-builder 因本机没有有效签名 identity 而按配置跳过签名。**该 DMG 在本次 `useStoreSnapshot` 修复之前构建，不能作为包含此修复的发布候选包，解除发布门禁前必须重新生成。**

最终隔离 DMG SHA-256：`6a784927e795dd00c488fc40c42e7bcef7493e99cfffe70678a8d3ed1188969e`。当前仓库 `release/BearPassword-Extension.zip` SHA-256：`d9ebfd13e1994ae47d2a03425f159eb5c633e5414816aec7f87113823bae1350`。

后处理脚本会清理项目 `release/` 中其他产物，因此仅在 `/tmp` 临时目录副本执行，确认安装说明成功写入 DMG 后卸载镜像。该临时验证不替换仓库 `release/` 中的既有 DMG。

## 人工与跨平台验收状态

详细操作项见 [TASK-UIR-09 人工验收记录](task-ui-refactor-09-manual-acceptance.md)。截至本记录：

- 桌面认证、恢复、保险库编辑/删除/批量、剪贴板清理、自动锁定、备份恢复、托盘/快捷键、主题/语言真人旅程：待维护者执行并签认。
- Extension popup 已检查到桌面未连接态；已连接态、TOTP、网页匹配/自动填充、快速保存、wake 协议冷启动和浏览器重启 session：待真人执行。
- Chrome/Chromium 扩展受控检查不是真人签认；Edge 真实安装和旅程：待 Edge 环境验证。
- Windows x64 installer：待 Windows 环境构建与安装验证。此前在 ARM Mac 上运行 Windows 打包因 Wine `bad CPU type` 失败，不能作为 Windows installer 验收证据。

## 发布判断

当前状态为 **HOLD / 不发布**。解除门禁至少需要：补充核心旅程 E2E 自动化或由维护者明确接受其缺口；P0/P1 缺陷为零或经维护者书面接受；人工记录完成桌面认证/密码库与扩展 popup/自动填充核心旅程；Chrome 和 Edge 验证完成；Windows installer 在 Windows x64 安装/卸载验证完成；发布包升级保留现有浏览器存储和本地保险库数据的验证记录。发布和回滚步骤见 [TASK-UIR-09 发布准备与回滚](task-ui-refactor-09-release-readiness.md)。
