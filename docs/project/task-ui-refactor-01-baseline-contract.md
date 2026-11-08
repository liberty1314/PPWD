---
artifact_id: TASK-UIR-01-BASELINE-001
phase: development
title: UI 重构基线盘点与迁移契约
status: completed
risk_level: mvp
owner: project-maintainer
version: 1.0
created_at: 2026-11-07
updated_at: 2026-11-07
depends_on:
  - docs/project/ui-refactor-development-plan.md
  - docs/design-proposal.md
  - docs/project/technical-design-m2.md
---

# TASK-UIR-01：基线盘点与迁移契约

## 目的与范围

本文记录 React UI 迁移前 desktop renderer、extension popup/wake、preload、扩展消息/存储、安全行为、构建入口和尺寸基线。后续任务以此为迁移前快照。本文仅依据代码和本次构建命令盘点；没有启动带真实用户保险库的应用，也没有把代理/静态检查记为真人 UI 验收。

本任务不修改生产代码、依赖、manifest、配置键或 UI。构建产生的 `out/`、`dist/` 和扩展 zip 属于忽略的构建产物，不纳入源码变更。

## 工程基线

| 模块 | 当前实现 | UI/运行入口 | 构建与包管理 |
| --- | --- | --- | --- |
| Desktop | Electron 33、Vue 3、Pinia、Vue Router、Element Plus、electron-vite 2 | `src/main.ts` → `src/App.vue`；独立 island window 使用 `IslandView.vue` | `pnpm-lock.yaml` 与 `package-lock.json` 并存；`pnpm run typecheck`、`pnpm run build` |
| Extension | Vue 3、Pinia、Vite、CRXJS beta；popup Vue 应用，wake 使用原生 DOM/TS | `src/popup/main.ts`、`src/wake/main.ts`；background 与 content 各自入口 | npm lock 与 pnpm 锁文件均存在；`pnpm run typecheck`、`pnpm run build`、`pnpm run package` |
| Root | Node 脚本调度桌面安装包和扩展 zip | `scripts/build-all.mjs` | `pnpm run build:all` / `build:extension` 等；默认 build:all 会触发平台打包并写 `release/` |

Desktop renderer 主要目录：`views/` 12 个页面/占位视图，`components/` common/settings/vault/window，`stores/` 14 个 Pinia stores，`composables/` 两个组合式函数，`router/` 路由，`locales/` 中英日词条，`styles/` 基础变量与多组旧主题，`utils/` 加密、存储、主题、locale、剪贴板、扩展桥接和数据转换。桌面入口不只是主窗口；Island 是单独业务窗口，必须一并迁移。

Extension UI 主要在 `src/popup/`（登录、vault、设置、条目/TOTP/确认对话框与 Pinia stores）；wake 页为独立 HTML/CSS/TS。`src/shared/` 同时服务 popup、background 与 content，包含 API、消息、locale/theme、Chrome storage、desktop bridge 和领域转换。`background/index.ts` 是 MV3 service worker，`content/` 为网页自动填充、候选选择、提示和生命周期脚本。React 只能进入 popup/wake，不能进入 background/content 或注入宿主页。

## 桌面 preload 契约

React renderer 必须继续只通过 contextBridge 暴露对象调用主进程，不得导入 Electron/Node 或重命名窗口全局对象。当前 `electron/preload/index.ts` 共暴露下列 16 个 API 对象：

| 全局对象 | 暴露方法/事件 | 关键兼容点 |
| --- | --- | --- |
| `windowApi` | `minimize`、`maximize`、`close`、`hide`、`focus`、`isMaximized`、`getPlatform`、`onFocused` | 前四项为 send；其余 invoke/订阅；订阅返回取消函数 |
| `themeApi` | `getShouldUseDarkColors`、`onUpdated` | OS 外观同步；取消订阅 |
| `shortcutApi` | `sync`、`getStatus`、`onLock`、`onOpen` | open/lock 两种快捷键、注册失败状态与事件 |
| `launchAtLoginApi` | `getSettings`、`setEnabled` | `available/enabled` 与 `{ok,error}` 联合结果 |
| `trayApi` | `getSettings`、`setSettings`、`syncAppearance`、`onAction`、`onCommand` | click action 为 vault/favorites/recent/settings；保留快照及命令载荷 |
| `dockApi` | `getSettings`、`setHidden` | `available/hidden` 与错误结果 |
| `islandApi` | `getSettings`、`setSettings`、`setExpanded`、`openEntry`、`touchActivity`、`onOpenEntry`、`onTouchActivity` | island 独立窗口及活动心跳 |
| `fileApi` | `pickPasswordCsv`、`savePasswordCsv`、`saveSecurityKeyBackup`、`pickEncryptedVaultBackup`、`saveEncryptedVaultBackup` | 用户文件选择、取消结果和备份内容 |
| `clipboardApi` | `readImageDataUrl` | 只读二维码图像数据及 empty 结果 |
| `localVaultApi` | `getStatus`、`create`、`biometricUnlock` | 本地 vault 初始化与生物识别；VUK 只作为短期命令结果 |
| `phoneTokenApi` | `isAvailable`、`has`、`set`、`verify`、`rebind`、`recover`、`destroy` | TOTP/恢复/销毁授权参数和联合结果 |
| `recoveryKeyApi` | `has`、`authorize`、`get` | 受授权恢复密钥读取；禁止 UI store 持久保存密钥 |
| `vaultPasswordApi` | `isAvailable`、`has`、`get`、`set`、`remove` | 系统安全存储中的 vault 密码读取/写入/移除 |
| `biometricApi` | `getAvailability`、`prompt` | Touch ID / Windows Hello 与取消状态 |
| `extensionBridgeApi` | `onRequest`、`sendResponse` | 本机扩展 bridge 请求/应答，订阅返回取消函数 |
| `offlineVaultApi` | `getDefaultDataDir`、`getSettings`、`setSettings`、`pickDataDir`、`pickEmptyDataDir`、`readSnapshot`、`importSnapshot`、`listEntries`、`createEntry`、`updateEntry`、`updateEntryRaw`、`deleteEntry`、`getFavoritesMeta`、`getFavoriteIds`、`addFavorite`、`removeFavorite`、`getRecentMeta`、`recordRecent` | 本地数据文件/条目和收藏/最近访问；保留参数形状、raw 更新路径及失败联合类型 |

IPC 通道以 preload 实现和 main 注册为准，当前覆盖 `window:*`、`theme:*`、`shortcut:*`、`launch-at-login:*`、`tray:*`、`dock:*`、`island:*`、`file:*`、`clipboard:*`、`local-vault:*`、`phone-token:*`、`recovery-key:*`、`vault-password:*`、`biometric:*`、`extension-bridge:*`、`offline-vault:*`。迁移时应以 `electron/preload/index.ts` 的调用参数/返回值和 `electron/main/` handler 配对，不自行从频道名字推断业务含义。

## 扩展消息、bridge 和存储契约

### Runtime message actions

`shared/types/index.ts` 的 `MessageType` 是 popup/background 协议的权威联合类型。完整 action 为：

`GET_DESKTOP_STATE`、`REFRESH_DESKTOP_STATE`、`GET_MATCHING_CREDENTIALS`、`GET_ALL_LOGIN_CREDENTIALS`、`AUTOFILL`、`SAVE_CREDENTIAL`、`CREATE_CREDENTIAL`、`UPDATE_CREDENTIAL`、`TOGGLE_FAVORITE`、`DELETE_CREDENTIAL`、`UPDATE_BADGE`、`GENERATE_PASSWORD`、`COPY_TEXT`、`WAKE_DESKTOP`。

Content 内部另有 `TRIGGER_DESKTOP_PROTOCOL`、`PERFORM_AUTOFILL`、`INSERT_TEXT` 三类 tab message。业务载荷类型包括匹配 URL/匹配方式/force、credentialId、站点保存信息、credential upsert 信息、badge 信息和待复制文本。返回值包含桌面 ready/loggedIn/unlocked/locked 状态、匹配凭据与安全密钥提示、唤起结果等；以 `shared/types/index.ts`、background switch 和 content listener 为契约来源，迁移时保持 action、字段名、触发时机与错误语义不变。

### 本机桌面 bridge 与 protocol

- Host/port：`127.0.0.1:6892`；认证头 `X-BearPassword-Bridge: BearPassword-Extension`。
- Wake protocol：`bearpassword://focus`；扩展 wake 页面 URL 由 `chrome.runtime.getURL('src/wake/index.html')` 生成。
- desktop bridge 状态携带 `ready`、`loggedIn`、`unlocked`、`locked`、`username`、`themePreference`、`localePreference`；敏感凭据不应被增加到 bridge 状态。
- `extensionBridge` 请求/响应类型位于根级 `shared/extensionBridge`，桌面 preload 将请求转发 renderer，React 适配层须保留请求 id 和响应结果。

### Chrome storage 与偏好

| Key | 用途/值 |
| --- | --- |
| `bear_extension_theme` | 扩展本地主题偏好，读取时经 normalize |
| `bear_extension_locale` | 扩展本地 locale 偏好，读取时经 normalize |
| `bear_extension_session`、`bear_extension_server` | 旧会话/服务器键；当前兼容函数只负责清理，不代表扩展重新独立登录 |

Desktop 的通用 storage 工具添加 `bear_` 前缀；已确认关键键有 `bear_theme`（store 中键 `theme`）、`bear_locale`、`bear_font`、`bear_auto_lock_minutes`、`bear_app_locked`、`bear_clipboard_clear_seconds`。`vaultSort.ts` 另用 localStorage 存排序和最近访问；安全密钥使用独立 `securityKeyStorage`/系统钥匙串逻辑，不能移入普通偏好存储或 Zustand persist。

当前桌面主题偏好值沿用 system/light 和既有主题 preset（见 `src/utils/theme.ts`）；设计迁移方案指定映射到 `appearanceMode`、`themeDesign`、`accentColor`，须幂等且不覆盖已存在新字段。该行为变化属于显式配置迁移，需要独立纯逻辑测试。扩展通过 desktop bridge 同步桌面 theme/locale；background/content bundle 不能依赖 React。

## 安全与计时行为基线

- 自动锁定默认 5 分钟，选项为 0/1/5/10/30/60/180/300 分钟；监听 pointerdown、keydown、wheel、touchstart、scroll（不监听 mousemove）。检查周期 1 秒；迁移数据期间暂停计时；锁定时持久化锁标记并清除内存安全密钥和解密条目缓存。
- 锁定副作用会清除仍由应用写入的敏感剪贴板内容。复制敏感内容默认 30 秒清理，可选 0/30/60/90/120 秒；非锁定超时清理前先比较剪贴板当前值，只有仍等于应用复制内容时才清空，避免覆盖用户后来复制的新内容。锁定时取消计时器并立即尝试清理。
- 密码默认遮蔽、按需显示；React 状态层不得持久化 master password、恢复密钥、VUK、解密后的整库内容或敏感剪贴板文本。登录/恢复和 vault 生命周期仍由现有安全业务命令负责。
- 主题/locale 同步会送 tray appearance snapshot；全局快捷键、托盘命令、Island 活动事件和窗口 focus 需要保持订阅清理及原有动作。
- Manifest V3 权限、host_permissions、background service worker、所有 frame content script 注入规则保持现状。不得把 UI runtime 打入 service worker/content script 或宿主页。

## 窗口与页面尺寸基线

| 表面 | 当前基线 | 迁移验收约束 |
| --- | --- | --- |
| Desktop 主窗口 | 默认 1024×720，Electron 最小 1024×640；窗口状态可持久化 | 设计计划要验 900px 窄窗口，但主窗口当前不允许缩至 900px。进入窄窗口页面验收前需单独确定是可视区域/缩放测试还是调整主进程 minWidth；本任务不改该值 |
| Extension popup 登录 | 登录页最小高度 480px | 浏览器实际 popup 视口下验证滚动与 focus |
| Extension popup vault | 根布局高度 480px，vault view 高度 560px | 当前页面规则不一致，需在 React popup 实现阶段确定统一且可用的窗口高度，不以 CSS 溢出掩盖 |
| Extension popup settings | settings view 高度 560px | 同上；在 Chrome/Edge 实测 popup 尺寸 |
| Wake 页面 | 独立 extension origin 页面，无固定 viewport 限制 | 保留 locale、重试和 protocol 唤起流程 |
| Island window | collapsed 168×38，expanded 440×400 | 单独 React 页面但保留 main-process 窗口尺寸与 bridge 命令 |
| Content script | `<all_urls>`、`all_frames: true`、`document_idle` | 网页注入样式隔离与事件清理需按真实站点回归 |

## 基线验证结果

执行环境：2026-11-07，macOS（repo 本地工具链），依赖已安装；以下命令均退出码 0。

| 命令 | 结果 | 观察 |
| --- | --- | --- |
| `cd bear-password-desktop && pnpm run typecheck` | 通过 | `vue-tsc --noEmit` |
| `cd bear-password-desktop && pnpm run build` | 通过 | main/preload/renderer 均产出；legacy Sass JS API 有重复弃用提示；renderer 主 JS 约 2708 kB，字体资源约 27.8 MB（构建报告值） |
| `cd bear-password-extension && pnpm run typecheck` | 通过 | `vue-tsc --noEmit` |
| `cd bear-password-extension && pnpm run build` | 通过 | CRXJS 报告 4 个 `public/icons/icon-*.png` 同名覆盖输出提示；popup JS 约 90.8 kB，gzip 约 34.7 kB |
| `cd bear-password-extension && pnpm run package` | 通过 | 脚本内部仍使用 `npm run build`；生成 `release/BearPassword-Extension.zip`（约 0.53 MB） |
| `pnpm run build:all -- --extension` | 通过 | 根脚本正确委派到扩展 package，生成同名发布包 |
| `pnpm run build:all -- --help` | 通过 | 根脚本 help 入口可运行 |

注意：未运行 macOS/Windows installer 打包（会构建平台发布包并写 `release/`）；未运行后端、web、真人 app 流程或 Chrome/Edge 安装后的自动填充旅程。当前桌面自动化测试只有 `test:phone-token`、`test:encrypted-backup` 两项 Node 测试，需在相关代码或发布门禁阶段按计划运行；扩展当前没有发现 `*.test.*` / `*.spec.*` 测试文件。

## 迁移需求追溯编号

本任务为后续 UI 改动建立稳定的 refactor 追溯编号（不替代业务需求编号）：

| ID | 迁移契约 |
| --- | --- |
| UIR-REQ-01 | desktop renderer 和 extension popup/wake 使用 React；main/preload、background/content 保留现职责 |
| UIR-REQ-02 | 所有 preload 全局对象、方法、参数、联合返回值、事件取消订阅和 IPC channel 保持兼容 |
| UIR-REQ-03 | runtime message、content tab message、bridge host/port/auth/protocol、manifest 权限与 storage key 保持兼容 |
| UIR-REQ-04 | 旧 theme 映射幂等，保留用户明暗偏好且不覆盖新偏好；扩展同步字段兼容 |
| UIR-REQ-05 | 锁定清除解密状态和本应用敏感剪贴板；剪贴板定时清理不覆盖后续第三方内容 |
| UIR-REQ-06 | 凭据秘密不写入持久 UI store；扩展 UI bundle 不进入 background/content/宿主页 |
| UIR-UX-01 | desktop 主窗口、900px 窄布局、popup 高度、wake、island 分别验收，记录视口尺寸和滚动/焦点结果 |
| UIR-UX-02 | 桌面主密码/恢复/vault/复制清理/自动锁定/托盘快捷键和扩展 popup/填充旅程按原行为回归 |

## 未解决项与下游门禁

1. Desktop minWidth=1024 与 900px 窄窗口验收目标冲突；进入 TASK-UIR-05 前确认测试视口解释或单独评估窗口尺寸决策。
2. Popup 当前规则 480/560px 不统一；TASK-UIR-06 应在 Chrome 与 Edge 实测并记录选定高度。
3. 扩展 `package` script 和根打包脚本通过 npm 调起内部 build，与 pnpm 单一包管理约束不一致；TASK-UIR-08 清理时一并切换。
4. Desktop 与 extension 均有 npm lock 与 pnpm lock；TASK-UIR-08 收口时确认 pnpm lock 唯一来源。
5. 旧配置主题迁移虽有设计映射说明，本次未发现专门测试覆盖；在 TASK-UIR-02/03 前补纯函数迁移测试并验证幂等。
6. 本地 bridge 的请求/响应契约已有根级类型和 header/port 常量，但目前没有独立契约测试；React renderer adapter 应新增不触及 Electron 的契约验证。
7. 交互式真人验收仍未执行，应在 TASK-UIR-09 按人工验收记录流程完成；本任务只为高风险路径提供迁移前代码与构建基线。

## 证据来源

- Desktop 入口和 preload：`bear-password-desktop/electron.vite.config.ts`、`bear-password-desktop/electron/preload/index.ts`、`bear-password-desktop/electron/main/`
- Desktop 状态/安全：`bear-password-desktop/src/stores/`、`src/utils/sensitiveClipboard.ts`、`src/composables/useAutoLockActivity.ts`、`src/utils/theme.ts`
- Extension 入口/契约：`bear-password-extension/vite.config.ts`、`manifest.config.ts`、`src/shared/types/index.ts`、`src/background/index.ts`、`src/content/index.ts`
- Bridge 常量：`shared/extensionBridge.ts`、`bear-password-extension/src/shared/constants/extensionBridge.ts`
- 设计追溯：`docs/design-proposal.md`、`docs/project/technical-design-m2.md`、`docs/prototypes/all-pages.html`

## 变更记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| 1.0 | 2026-11-07 | 完成迁移前模块、接口、安全行为、尺寸和构建基线盘点。 |
