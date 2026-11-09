---
artifact_id: TEST-M2-002
phase: testing
title: 手机令牌门禁自动化测试报告
status: in_review
risk_level: production
owner: 实施者
reviewers: [项目维护者]
version: 1.0
created_at: 2026-11-04
updated_at: 2026-11-06
depends_on: [TECH-M2-001, TASK-M2-001, DEV-M2-001]
supersedes: []
---

# 手机令牌门禁自动化测试报告

## 目的与范围

记录 T20–T26 的自动化验证结果。高风险桌面交互、Electron safeStorage 行为、IPC 权限与系统生物识别需结合 `manual-verification-m2.md` 真人验收。

## 输入与依赖

- 需求：`docs/需求文档.md` 第 3、4、8、9 节。
- 技术设计：`docs/project/technical-design-m2.md`。
- 开发报告：`docs/project/development-report-m2.md`。

## 自动化验证结果

| 层级 | 范围 | 命令/测试 | 结果 |
| --- | --- | --- | --- |
| 单元 | 令牌密钥熵与格式、恢复密钥长度、URI/二维码、TOTP 当前步/±1 步、超窗/错码拒绝、防重放、失败锁定门槛 | `pnpm run test:phone-token`，7 tests | 通过，7/7 |
| 构建 | Electron 主进程、preload、renderer 生产打包 | `pnpm run build` | 通过 |
| 类型 | Vue/TypeScript 全项目 | `pnpm run typecheck` | 失败，报告阶段 0 已有的多处类型错误；本阶段新增的门禁代码无额外类型诊断 |
| 组件/E2E | 真实渲染交互及跨 Electron IPC 流程 | N/A，项目当前没有对应测试框架和 Electron 测试夹具 | 真人验收清单补足；不能据此宣称通过 |

## 未覆盖项

- Electron `safeStorage` 真机可用/不可用、加密文件落盘内容与损坏状态恢复。
- IPC 并发、重启后失败计数/锁定持久化、绑定成功后冷启动校验。
- Setup/Bind/Unlock/Recover/设置换绑与恢复的真实用户交互及视觉、键盘/焦点。
- macOS Touch ID 与 Windows Hello 冷启动优先解锁、取消后 TOTP-only 解锁，以及偏好关闭后的主密码 + TOTP 回退。
- 数据目录已有数据拦截、切空目录后的中断续作。

以上项目按生产风险保留为硬验收 Todo，见 `docs/project/manual-verification-m2.md`。

## 风险与未决问题

- 阶段 0 基线类型检查已经失败；本次错误集合仍包含相同的旧 API、Island、settings、WebCrypto 与组件类型诊断。基线文件：`docs/阶段0-基线记录.md`。
- 自动化测试不覆盖 Electron 存储和 UI 集成；项目维护者已于 2026-11-06 确认人工验收通过，逐项平台证据待补录。

## 证据与追溯

- T20：`ppwd-desktop/tests/phoneToken.test.mjs`。
- `pnpm run test:phone-token`：2026-11-04，通过 7/7。
- `pnpm run build`：2026-11-04，通过。
- `pnpm run typecheck`：2026-11-04，退出码 2；基线错误未消除。
- 追溯：`REQ-M2-001` → `TECH-M2-001` → `TASK-M2-001` → `TEST-M2-002` / `TEST-MANUAL-M2-001`。

## 变更记录

| 版本 | 日期 | 变更 | 影响 |
| --- | --- | --- | --- |
| 1.0 | 2026-11-04 | 首次记录阶段 2 自动化验证 | 阶段出口证据 |

## 门禁记录

### GATE-M2-TEST-001
- 阶段：testing
- 评审日期：2026-11-06
- 风险级别：production
- 结论：人工验收通过；类型检查基线复核待处理
- 评审人：实施者自审；项目维护者于 2026-11-06 确认人工验收通过

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| 必填内容完整 | 通过 | 本报告 |
| 关键输入已追溯 | 通过 | REQ-M2-001、TECH-M2-001、TASK-M2-001 |
| 阶段专属门禁 | 通过 | 项目维护者于 2026-11-06 确认人工验收通过 |
| 自动化测试按风险分层且证据可复现 | 有缺口 | 单元测试与构建通过；E2E 未覆盖 |
| UI 变更清单和人工验收 Todo 完整，且已由真人执行 | 通过 | `docs/project/manual-verification-m2.md`；逐项证据待补录 |

#### 例外与风险
- 风险/例外：逐项真人验收证据尚未归档；类型检查基线失败。
- 影响：人工测试门禁通过；类型检查仍待基线对照复核。
- 负责人：项目维护者。
- 截止时间：阶段 2 出口评审前。
- 复验条件：补录人工验收 Todo 的平台和证据；类型错误与基线对比确认无新增。

#### 下一步
- 动作：补录已通过人工验收的截图、步骤结果与平台信息，并复核类型错误基线。
- 负责人：项目维护者。
- 前置决策：无。
