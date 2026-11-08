# TASK-UIR-04 开发记录：桌面认证、设置与概览

## 结论

桌面认证、设置、外观和概览页面已迁入 React，并作为桌面默认 renderer。React 继续调用现有 Pinia 业务 stores 和 Electron preload API；Zustand 只存放非敏感门禁快照。TASK-UIR-05 的密码库业务页面和认证后的条目导航仍由后续任务迁移。

## 实施范围

- 增加 setup、unlock、recover、bind 四种认证页面和认证门禁；保留本机恢复密钥生成、Emergency Kit 导出确认、手机 TOTP 绑定/换绑、生物识别解锁和失败状态。
- 新增桌面认证与设置 adapters，封装本地保险库、手机令牌、加密备份导入导出、恢复密钥授权读取和 Electron preload 调用。
- 迁移通用、安全、外观、快捷键、加密备份和关于设置；备份导入前先保存当前保险库的加密备份，删除本机保险库前也必须先成功保存加密备份。
- 增加概览统计、安全摘要和最近访问条目；统计为只读摘要，密码库、收藏和最近访问的目标页面由 TASK-UIR-05 接入。
- 桌面入口默认使用 React；`?ui=vue` 保留为 TASK-UIR-08 移除 Vue 前的临时回退路径。补齐中文、英文和日文新增文案。

## 状态与安全边界

- React session store 仅持有初始化、保险库存在/绑定、是否可访问及迁移状态；VUK 仍只由原安全 store 保存在内存中，锁定时由既有逻辑清除。
- 恢复密钥需主密码与 TOTP 授权后才显示；主密码、恢复密钥和验证码不写入 Zustand 或持久化设置。
- 认证页面通过 Pinia 状态订阅同步门禁；锁定清除解密密钥后返回解锁路由。
- 不改 Electron main/preload 协议、加密数据格式、令牌验证规则或扩展行为。

## 验证

| 检查 | 结果 |
| --- | --- |
| desktop `pnpm run typecheck` | 通过 |
| desktop `pnpm run build` | 通过；React renderer、Electron main/preload 均产出 |
| `tests/reactGateRules.test.mjs` | 3 项通过 |
| `tests/themePreferenceMigration.test.mjs` | 3 项通过 |
| 新页面静态翻译键（zh-CN/en/ja） | 全部存在 |
| `git diff --check` | 通过 |

## 验收限制与后续

通过 ego lite 打开 Vite 页面时没有 Electron preload，页面停留在初始化状态；桌面窗口检查打开的是 Electron 示例窗口，未能验证项目 Electron 窗口中的真实认证旅程。因此创建、锁定/解锁、恢复、设置、托盘及快捷键真人验收留在 TASK-UIR-09 记录，不计为本次已通过。TASK-UIR-05 需要为概览统计和最近访问入口连接实际密码库路由。

构建仍包含旧 Vue renderer 供临时回退；Vue 依赖、旧页面与双入口将在 TASK-UIR-08 收口。
