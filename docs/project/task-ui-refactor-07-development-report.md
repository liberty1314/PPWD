# TASK-UIR-07 开发记录：扩展集成、content-script 与桌面桥接回归

## 结论

扩展生产构建、发布 zip、manifest/action 契约及 content-script 依赖边界已完成检查；没有发现 React runtime 进入 MV3 service worker 或 content script。检查发布 zip 时发现旧归档会保留已不在 `dist` 中的历史 bundle，已将打包改为同步归档，避免旧条目继续发布。

用户随后在 ego lite Chromium 安装了 BearPassword 扩展并启动桌面端。本次复测确认 popup 状态读取及真实 bridge 可用，桌面解锁后在本机临时登录表单完成唯一凭据匹配和 `AUTOFILL` 填充；填写结果正确，临时凭据已通过 `DELETE_CREDENTIAL` 删除，并复查匹配结果为零。桌面运行时 `WAKE_DESKTOP` 返回 `focused`。桌面曾自动锁定，测试尊重锁定门禁并等待解锁后继续。

当前已完成 Chromium 单浏览器的 popup/bridge/content-script 基本集成旅程。Edge 安装与回归、浏览器重启 session、TOTP/验证码复制、快速保存和 wake 页真实协议确认仍留待 TASK-UIR-09，不计为通过。

## 实施与检查范围

- 对照 TASK-UIR-01 基线核对 runtime action：`GET_DESKTOP_STATE`、`REFRESH_DESKTOP_STATE`、`GET_MATCHING_CREDENTIALS`、`GET_ALL_LOGIN_CREDENTIALS`、`AUTOFILL`、`SAVE_CREDENTIAL`、`CREATE_CREDENTIAL`、`UPDATE_CREDENTIAL`、`TOGGLE_FAVORITE`、`DELETE_CREDENTIAL`、`UPDATE_BADGE`、`WAKE_DESKTOP`、`GENERATE_PASSWORD`、`COPY_TEXT`；source manifest 的权限、`<all_urls>`/`all_frames`/`document_idle`、popup、service worker 和 wake 路径均与 HEAD 基线一致。
- 检查 production manifest 与 content loader：content script loader 只动态载入原 content bundle；bundle imports 为 locale、网站匹配、复制和桌面协议模块，没有 React/primitives 引用。React runtime 仅被 popup/wake 页面模块图引用。
- 检查桌面 bridge 契约仍使用 `127.0.0.1:6892`、`X-BearPassword-Bridge: BearPassword-Extension` 与 `bearpassword://focus`；background 的 `WAKE_DESKTOP`、`AUTOFILL`、快速保存和 `PERFORM_AUTOFILL` 消息调用维持既有字段与流程。
- 修正 `scripts/package-zip.mjs` 使用 `zip -FS` 同步更新归档。重打包后确认旧 hash bundle 已从 ZIP 移除，ZIP 内容与当前 `dist` 一致；保留当前 React 与临时 Vue 回退资源。

## 验证

| 检查 | 结果 |
| --- | --- |
| extension `pnpm run package` | 通过；pnpm typecheck、Vite production build 与 ZIP 打包成功 |
| extension `pnpm run test:locale` | 3 项通过 |
| extension zip 打包及清单检查 | 通过；`release/BearPassword-Extension.zip` 已重新同步，没有旧 hash 文件残留 |
| React runtime 泄漏检查 | 通过；content loader/bundle 和 service worker loader 未引用 React runtime 或 primitives chunk |
| manifest/source 契约核对 | 通过；权限、消息 action、入口和 content 注入设置与 TASK-UIR-01/HEAD 基线一致 |
| ego lite + Chromium 扩展管理页 | 通过；确认 BearPassword 26.9.9 已加载且启用 |
| popup 与桌面 bridge | 通过；真实 popup 显示桌面状态，bridge 报告 ready/loggedIn/unlocked |
| 临时网站凭据匹配与自动填充 | 通过；本机 fixture `127.0.0.1:6893` 唯一匹配，用户名和密码字段与临时测试值一致 |
| 临时数据清理 | 通过；`DELETE_CREDENTIAL` 成功，后续匹配不再返回临时条目 |
| `WAKE_DESKTOP` 桌面已运行路径 | 通过；返回 `focused` |
| 桌面协议启动未运行路径 | 未覆盖；桌面运行时走 focus 分支，没有触发外部协议确认 |
| Edge 与浏览器重启 session | 未覆盖；需在 TASK-UIR-09 验收 |
| 桌面 `extensionBridgeAccess.test.ts` | 未运行；直接 Node 测试无法解析其 `.js` 源码导入，仓库无 `tsx` 执行器 |
| `git diff --check` 与暂存区检查 | 通过 |

## 待真实环境完成

TASK-UIR-09 需在安装了扩展且桌面 bridge 可用的环境完成：Chrome 和 Edge 安装/重载；已登录与锁定 session；匹配候选、选择填充和多候选 popup；TOTP/验证码复制；登录成功后的快速保存；唤起桌面协议及 bridge unavailable/available；浏览器重启后的 session。自动化静态检查与 ego lite 管理页检查不能代替这些真实旅程。
