---
artifact_id: DEV-M2-001
phase: development
title: 手机令牌门禁阶段开发报告
status: in_review
risk_level: production
owner: 实施者
reviewers: [项目维护者]
version: 1.0
created_at: 2026-11-04
updated_at: 2026-11-06
depends_on: [TECH-M2-001, TASK-M2-001, UX-M2-001, TEST-MANUAL-M2-001, TEST-M2-002]
supersedes: []
---

# 手机令牌门禁阶段开发报告

## 目的与范围

记录 T20–T26 的实现变更、自动验证和人工验收结论。范围是桌面端本地创建、手机 TOTP 绑定/解锁、恢复与换绑、生物识别限制；项目维护者已于 2026-11-06 确认人工验收通过，全量类型检查仍有基线错误待复核。

## 输入与依赖

- 需求：`docs/需求文档.md` 第 3、4、8、9 节（REQ-M2-001）。
- UX：`docs/project/product-design-m2.md`（UX-M2-001）。
- 技术设计：`docs/project/technical-design-m2.md`（TECH-M2-001）。
- 实施计划：`docs/project/implementation-plan-m2.md`（TASK-M2-001）。
- 人工验收：`docs/project/manual-verification-m2.md`（TEST-MANUAL-M2-001）。
- 自动化测试：`docs/project/test-report-m2.md`（TEST-M2-002）。

## 实现摘要

- T20：新增 160 位随机 Base32 令牌密钥、`otpauth://` 与二维码、±1 步 TOTP 校验、防重放、失败锁定状态规则；恢复密钥使用 96 字节随机源及 128 字符 Base64URL 格式。
- T21：主进程使用 Electron `safeStorage` 独立加密保存令牌状态、恢复密钥和本地保险库校验元数据；IPC 不向 renderer 暴露已绑定令牌密钥；安全存储不可用时拒绝创建/绑定/解锁；审计只写事件与时间。
- T22–T23：以本地状态替代账号状态；增加 Setup、Bind、Unlock、Recover 路由；未创建、未绑定、未解锁分别被路由守卫拦截；启动时不恢复服务端会话；锁定时清除 VUK、条目缓存及剪贴板。
- T24：设置页提供旧令牌 + 主密码换绑、主密码 + 恢复密钥恢复，以及再次验证后一次性读取恢复密钥的入口；主进程在换绑/恢复验证通过时即原子清除旧绑定，应用中断也不会保留旧令牌。
- T25：新增本地保险库创建与恢复密钥一次性展示；Emergency Kit 去账号化；已有数据目录要求先选空目录，不合并、不迁移。
- T26：快捷解锁偏好开启后，冷启动和锁定时均可由系统生物识别取用 safeStorage 中加密的主密码；TOTP-only 路径也由主进程取用该密码。偏好关闭时删除已保存密码并恢复主密码 + TOTP。

## UI 变更清单

- 路由/页面：`/setup`、`/bind`、`/unlock`、`/recover`；设置内手机令牌管理面板；主界面路由要求已解锁。
- 组件：`SetupView.vue`、`BindView.vue`、`UnlockView.vue`、`RecoverView.vue`、`MfaSettingsPanel.vue`（替换为本机令牌管理）。
- 用户旅程：首次创建、恢复材料导出、验证器绑定、冷启动解锁、自动锁定、令牌换绑、丢失恢复、恢复密钥查看、生物识别快捷解锁。
- 状态：默认、加载、验证失败、锁定、safeStorage 不可用、已有数据目录阻止创建、重复提交、路由无权限。
- 自动化覆盖：TOTP/恢复密钥/锁定策略单元测试；Electron IPC 与真实 UI 链路尚无自动化端到端覆盖，转由真人验收 Todo 验证。
- 安全复核修正：将换绑/恢复从“授权后由 renderer 另发删除 IPC”改为主进程验证与旧绑定清除一次写入，避免两次 IPC 间应用退出导致旧令牌继续有效。
- 真人验收：项目维护者于 2026-11-06 确认阶段 2 人工验收通过；逐项平台和证据链接待补录，见 `docs/project/manual-verification-m2.md`。

## 风险与未决问题

| 风险 | 影响 | 负责人 | 复验条件 |
| --- | --- | --- | --- |
| 真人验收逐项证据尚未归档 | 验收结论可追溯性不足 | 项目维护者 | 补录人工验收表各 Todo 的平台、结果和证据 |
| `pnpm run typecheck` 基线失败 | 全量类型门禁不能通过 | 项目维护者 | 修复基线错误后重新检查，或提供可审查的错误集对比 |

未决产品决策：无；需求 v3 已锁定流程。

## 证据与追溯

- T20：`bear-password-desktop/src/utils/phoneToken.ts`、`bear-password-desktop/tests/phoneToken.test.mjs`。
- T21：`bear-password-desktop/electron/main/phoneTokenStorage.ts`、`bear-password-desktop/electron/main/recoveryKeyStorage.ts`、`bear-password-desktop/electron/main/localVaultCryptoStorage.ts`。
- T22–T26：`bear-password-desktop/src/views/unlock/`、`bear-password-desktop/src/stores/auth.ts`、`bear-password-desktop/src/stores/security.ts`、`bear-password-desktop/electron/main/phoneTokenIpc.ts`。
- 测试结论与命令：`docs/project/test-report-m2.md`。
- 链路：`REQ-M2-001` → `UX-M2-001` / `TECH-M2-001` → `TASK-M2-001` → `TEST-M2-002` / `TEST-MANUAL-M2-001`。

## 变更记录

| 版本 | 日期 | 变更 | 影响 |
| --- | --- | --- | --- |
| 1.0 | 2026-11-04 | 记录 T20–T26 实现与验证证据 | 阶段开发输入 |

## 门禁记录

### GATE-M2-DEV-001
- 阶段：development
- 评审日期：2026-11-06
- 风险级别：production
- 结论：人工验收通过；类型检查复核待处理
- 评审人：实施者自审；项目维护者确认人工验收

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| 必填内容完整 | 通过 | 本开发报告及依赖产物 |
| 关键输入已追溯 | 通过 | REQ-M2-001、UX-M2-001、TECH-M2-001、TASK-M2-001 |
| 阶段专属门禁 | 通过 | 项目维护者于 2026-11-06 确认人工验收通过 |
| 自动化测试按风险分层且证据可复现 | 有缺口 | T20 单元测试通过；IPC/E2E 未覆盖；见 TEST-M2-002 |
| UI 变更清单和人工验收 Todo 完整，且已由真人执行 | 通过 | TEST-MANUAL-M2-001；逐项证据待补录 |

#### 例外与风险
- 风险/例外：人工验收通过但逐项平台证据未归档；全量类型检查有基线错误。
- 影响：人工验收门禁通过；类型检查门禁需对照阶段 0 基线复核。
- 负责人：项目维护者。
- 截止时间：阶段 2 出口评审前。
- 复验条件：归档逐项人工验收证据；类型错误与阶段 0 基线逐项比较并关闭新增项。

#### 下一步
- 动作：补录已通过人工验收的逐项平台和证据；对照阶段 0 基线复核类型错误。
- 负责人：项目维护者。
- 前置决策：无。
