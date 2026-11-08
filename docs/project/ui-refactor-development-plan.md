---
artifact_id: TASK-UIR-PLAN-001
phase: development
title: 桌面端与浏览器扩展 React UI 重构开发计划
status: draft
risk_level: mvp
owner: project-maintainer
reviewers: []
version: 1.2
created_at: 2026-11-07
updated_at: 2026-11-08
depends_on:
  - docs/design-proposal.md
  - docs/prototypes/all-pages.html
  - docs/project/technical-design-m2.md
supersedes: []
---

# BearPassword UI 重构开发计划

## 目的与范围

本计划把 [UI 改版方案](../design-proposal.md) 和 [交互式全页面原型](../prototypes/all-pages.html) 转化为可分阶段实施和验收的工程任务。目标是将桌面端 Electron renderer、浏览器扩展 popup 和扩展 wake 页面迁移到 React，重构为设计文档定义的界面，并确保加密、安全、IPC、自动填充和扩展通信行为不因 UI 框架迁移而改变。

计划范围包括：

- `bear-password-desktop` 的 renderer、页面组件、路由、状态适配、设计 token 和主题设置。
- `bear-password-extension` 的 popup、wake 页面、共享 locale/theme 响应式耦合与 Vite 插件配置。
- 桌面端与扩展的依赖、pnpm 锁文件、类型检查、构建和回归验证流程。
- 原型覆盖的 24 个桌面场景及扩展登录、保险库、设置和从网页唤起桌面端的流程。

不在本计划内：

- 重写 Electron main、preload、安全 IPC、本地保险库加密、服务端 API、数据格式或扩展 manifest 权限。
- 把 React 注入网页、在 background/content script 中运行 React，或迁移无 UI 的脚本到 React。
- 实现账户绑定、云同步或设计文档未包含的新产品功能。
- 重做浏览器自动填充算法、服务端认证协议或密码加密格式。

## 输入与依赖

| 输入 | 用途 |
| --- | --- |
| `docs/design-proposal.md` | 页面布局、主题模型、组件采纳、安全与兼容要求 |
| `docs/prototypes/all-pages.html` | 桌面页面和状态原型，当前包含 24 个场景 |
| `docs/prototypes/all-pages/*.png` | 桌面场景视觉基准 |
| `docs/prototypes/bearpassword-vault-concept.html` | 密码库主界面交互与视觉参考 |
| `docs/project/technical-design-m2.md` | 现有技术边界、IPC 与业务实现约束 |
| `AGENTS.md` | pnpm、目录边界、测试与安全约定 |

当前基线事实：桌面端采用 Electron + Vue 3 + Pinia + Vue Router + Element Plus + electron-vite；扩展采用 Vue 3 + Pinia + Vite + `@crxjs/vite-plugin`。扩展 popup 和 wake 页面有 UI；background/content scripts 为独立 TypeScript 入口。两模块当前都有 npm 锁文件，桌面端另有 pnpm 锁文件。实施前重新检查仓库状态，不覆盖与本计划无关的工作区修改。

## 决策与实现约束

- 桌面和扩展 UI 使用 React、TypeScript；桌面继续使用 electron-vite，扩展继续使用 `@crxjs/vite-plugin`，分别配置 Vite React 插件。
- 推荐 React Router、Zustand、Tailwind CSS、Radix UI/shadcn 和 `lucide-react`。React Hook Form/Zod 仅在与当前校验逻辑核对后用于复杂表单。依赖版本在任务启动时按仓库 Node/Electron 版本和插件兼容矩阵锁定。
- EasyUI 的 React/shadcn registry 控件按需采纳；21st.dev 组件在逐项检查源码、依赖、许可、键盘和可访问性后才接入。社区示例不得直接决定 BearPassword 的视觉变量。
- 产品专属的密码库列表/详情、敏感字段、密码生成器、TOTP、恢复密钥、自动填充确认和保险库操作由项目维护；不得依赖展示组件承载安全策略。
- 保持现有 preload 暴露的 Electron API 和扩展消息契约。React UI 不直接导入 Electron 模块、不访问 Node API。
- Zustand 用于应用/界面状态适配，不延长明文密码、恢复密钥或解密后的保险库内容的存活时间。
- 桌面和扩展统一使用 pnpm。迁移结束后移除两模块中 Vue 运行时、Pinia、Vue 插件与 vue-tsc；Element Plus 仅从桌面端移除。
- shared locale、theme、storage、API 和数据转换逻辑不依赖 Vue/React 响应式 API；React stores 通过纯函数或显式订阅接口读取和更新它们。
- 单一开发者顺序执行阶段任务；任务之间的接口按依赖图排序。不得为迁移临时让两个框架在同一个 UI 页面长期并行挂载。

## 需求与验收追溯

现有设计方案尚未使用稳定的 `REQ`/`UX` 编号。本计划先使用任务编号 `TASK-UIR-01` 至 `TASK-UIR-09`，并以文件章节作为设计追溯位置；进入实施阶段前，可在需求文档建立正式 `REQ`、`UX` 编号，再同步到本计划。

| 设计依据 | 任务 | 关键验收证据 |
| --- | --- | --- |
| 设计方案“前端 React 迁移方案” | TASK-UIR-01、02、03、08 | IPC 边界测试、旧配置迁移测试、renderer 构建 |
| 原型：概览、密码库、收藏、最近访问 | TASK-UIR-04、05 | 页面交互测试、桌面用户旅程、截图和真人验收 |
| 原型：认证、设置、外观和状态场景 | TASK-UIR-03、04 | 主密码/恢复流程、主题矩阵、状态交互验收 |
| 设计方案“前端 React 迁移方案” | TASK-UIR-02、03、06、08 | 无 Vue shared 模块、无 React 的 background/content 构建 |
| 扩展现有 popup、wake、content 流程 | TASK-UIR-02、06、07 | 扩展构建、popup 交互与网页自动填充回归 |
| 设计方案“安全要求” | TASK-UIR-02、04、05、06、07、09 | 安全回归清单、敏感值生命周期检查、人工验证记录 |

## 任务依赖图

```text
TASK-UIR-01 基线盘点与迁移契约
  └─ TASK-UIR-02 shared 逻辑去框架化
       └─ TASK-UIR-03 React 基础设施与主题
            ├─ TASK-UIR-04 桌面认证、设置、概览
            ├─ TASK-UIR-05 桌面密码库与工作流
            └─ TASK-UIR-06 扩展 popup 与 wake React 化
                 └─ TASK-UIR-07 扩展集成与自动填充回归
TASK-UIR-04 + TASK-UIR-05 + TASK-UIR-06 + TASK-UIR-07
  └─ TASK-UIR-08 移除 Vue、锁文件与构建收口
       └─ TASK-UIR-09 全量质量门禁、人工验收与发布准备
```

该图描述技术依赖，不表示并行实施；同一开发者按阶段顺序推进。若实现中发现契约或安全风险，应先更新技术设计并重新评估下游任务。

## 分阶段实施任务

### TASK-UIR-01：基线盘点与迁移契约

**上下文简报**：在改代码前确认 Vue/Pinia 使用面、Electron preload API、扩展消息、配置存储格式、构建入口和现有测试。所有安全行为和对外契约都作为迁移前后比较基准。

**变更边界**：仅新增/更新迁移清单、契约测试或技术决策记录；此阶段不替换 UI 页面，不改变生产配置。

**执行项**：

- 梳理 desktop renderer 的 Vue 页面、组件、Pinia stores、composables、路由、主题、i18n 和 IPC 使用点。
- 梳理 extension popup、wake、shared、background、content script 的入口及依赖方向。
- 对 `window.*Api` preload 接口、extension bridge 消息、Chrome storage key、主题旧值、剪贴板清理和自动锁定时序建立兼容清单。
- 确认 `pnpm run typecheck`、`pnpm run build`、扩展 `pnpm run package`、根构建脚本的当前基线结果，并记录失败项。
- 记录屏幕尺寸基线：桌面常规窗口、900px 窄窗口、扩展 popup 实际宽高、wake 页和 Chrome/Edge 页面注入环境。

**验证与退出条件**：契约清单覆盖所有 preload 方法和 extension message action；构建基线和现有缺陷有记录；高风险回归路径可以在迁移前执行。涉及接口不清楚时先更新 `technical-design-m2.md` 或新增 ADR，不开始替换入口。

### TASK-UIR-02：Shared 业务逻辑去框架化

**上下文简报**：扩展 `src/shared/locale/locale.ts` 当前导入 Vue `ref`；其他 shared 状态也要检查 Vue/Pinia 依赖。Background/content script 不能携带 UI 框架运行时，desktop 与 popup 要能分别用 React 状态层适配相同规则。

**变更边界**：`bear-password-desktop/src` 和 `bear-password-extension/src/shared` 中被多入口复用的框架无关逻辑；不改 IPC/扩展消息协议、加密格式和浏览器权限。

**执行项**：

- 将 locale/theme preference 解析、存储、格式化与校验拆为纯 TypeScript 函数；变化通过显式 setter、事件订阅或调用方 store 更新，不导入 Vue/React。
- 抽查 API、storage、数据转换、密码生成、TOTP、clipboard、desktop bridge 模块的框架依赖，解除不必要的响应式耦合。
- 给主题偏好迁移函数补充旧配置映射测试：原 `theme` 预设迁移到 `appearanceMode`、`themeDesign`、`accentColor` 时幂等且不覆盖已有新值。
- 不改密码派生、加密、服务端认证或恢复密钥业务规则；若需调整，另立安全审查和测试任务。

**验证与退出条件**：shared TypeScript 模块不导入 `vue`、`pinia` 或 React；extension background/content 独立 bundle 不包含 UI runtime；纯逻辑测试覆盖旧值、缺失值、无效值和订阅取消。桌面与扩展原 Vue 应用仍通过 typecheck/build。

### TASK-UIR-03：React 基础设施、设计 token 与主题

**上下文简报**：React UI 使用共同的语义 token，但 desktop renderer 与 extension popup 需各自有适配外壳。保留 Electron 主进程和扩展 Vite/CRXJS 的入口职责。

**变更边界**：两个 UI 工程的依赖、renderer/popup/wake HTML 入口、基础路由/状态与全局样式；不替换主页面业务。

**执行项**：

- desktop：配置 `@vitejs/plugin-react`，迁移 electron-vite renderer 入口，建立 React root、错误边界、React Router、Zustand 和 preload adapter。
- extension：配置 Vite React 插件并保留 `@crxjs/vite-plugin`、manifest v3、background/content script 构建项；为 popup 与 wake 页建立 React root。
- 建立语义 CSS variables 与 Tailwind/shadcn 基础层，覆盖近中性表面、文字、边框、焦点、状态色和 reduced-motion。
- 实现三维外观模式、四种主题设计和六种强调色，并保持颜色与主题材质分离；敏感字段使用实底。为液态玻璃实现透明度/模糊不支持时的静态回退。
- 实现系统主题、字体、语言状态与 Electron tray appearance snapshot 的桥接；迁移旧主题配置时不改变用户明暗偏好。
- 建立基础 button/input/select/dialog/menu/toast/accessibility 组件，EasyUI registry 与 21st.dev 组件在本阶段按实际需求逐项采纳，不做整库拷贝。

**验证与退出条件**：desktop renderer 和 extension popup/wake 可启动、类型检查和生产构建通过；preload API 调用仍经过类型化 adapter；四主题、六色、明暗模式、reduced-transparency 和 reduced-motion 有行为验证；Electron 主进程与 extension background/content bundle 入口没有被 React 化。

### TASK-UIR-04：桌面认证、设置与概览

**上下文简报**：依据原型的初始化、首次使用、解锁、恢复、通用/安全/外观/快捷键设置、备份和概览场景迁移。流程仍由现有 stores/API 和 preload 控制，React 仅替换 UI 与适配层。

**变更边界**：桌面认证、设置和概览路由及对应 React 组件；不改变账户绑定事实、加密规则、托盘 main process 协议或恢复密钥生成方式。

**执行项**：

- 迁移认证壳、创建/解锁/恢复/首次使用流程与失败、加载、确认状态；按已确认的本地保险库需求处理旧 Bind 路由，不在新 UI 增加云账户能力。
- 迁移设置通用、安全、外观、快捷键与备份入口；主题预览支持四主题、六强调色及系统/浅色/深色交互。
- 迁移概览、安全摘要与最近访问入口，明确各统计卡片导航行为。
- 从 Vue/Pinia 原 store 提取必要业务命令到 adapter，再由 Zustand 管理 UI 状态；避免把加密会话秘密复制进长期全局 store。
- 为登录/设置表单加入键盘焦点、错误文案、禁用/忙碌与重复提交保护。

**验证与退出条件**：创建、启动后锁定、解锁、错误密码、恢复密钥、备份入口、系统托盘、快捷键、主题与语言同步通过自动化与桌面人工验收；安全页面没有明文秘密意外呈现；相关页面与原型对照记录完成。

### TASK-UIR-05：桌面密码库与关键工作流

**上下文简报**：密码库是最高复杂度模块，当前 `VaultView.vue` 体量大且集成条目、选择、复制、导入、编辑和快速搜索相关行为。先保持业务 API/commands 稳定，再拆解 React 页面。

**变更边界**：密码库、收藏、最近访问、安全中心、新增条目表单、批量操作、快速搜索及窄窗口布局；不重写加密、数据持久化、自动填充协议和剪贴板服务。

**执行项**：

- 拆为 `VaultWorkspace`、toolbar/search/filter、virtualizable entry list、detail panel、entry forms、sensitive field、password generator、TOTP display、confirm dialog 等有清晰职责的组件。
- 实现条目载入、空库、无搜索结果、错误、加载 skeleton、选中、批量选择、删除确认、详情缺失和窄窗口返回列表状态。
- 保持用户名/密码遮蔽、按命令显示密码、复制反馈、自动清理剪贴板、危险操作确认和自动锁定行为。
- 支持登录、信用卡、身份、安全笔记、验证器、数据库等类型，以及 TOTP、自定义字段和备注；附件入口仅在基线确认已有 schema/API 后迁移。当前桌面密码库未发现附件 schema、API 或既有界面入口，不在本次新增持久化能力。
- 迁移收藏、最近访问与安全中心，保证筛选、排序、导航和风险项操作对应真实业务。
- 对 900px 窄窗口检查滚动容器、详情折叠/返回和表单单列行为。

**验证与退出条件**：核心 vault 旅程完成组件交互测试和 E2E；复制、删除、批量操作、编辑与类型表单对现有 API 的调用契约一致；所有错误和空状态可恢复；完成常规和窄窗口真人验收。

### TASK-UIR-06：扩展 popup 与 wake 页面 React 化

**上下文简报**：扩展 popup 当前包含登录、保险库、设置、TOTP 和条目对话框；wake 页面通过桌面协议唤起应用。popup 有独立尺寸和登录状态，不应套用桌面外壳。

**变更边界**：`src/popup`、`src/wake` 的 UI 和状态适配；不改 manifest 权限、Chrome storage schema、desktop protocol URL、background 消息和网页 content script UI 实现。

**执行项**：

- 迁移 popup App、LoginView、VaultView、SettingsView、CredentialItem、CredentialTotp、登录条目对话框和确认对话框。
- 使用 Zustand 管理 popup 页面、session、theme、locale 与版本 UI 状态；调用 shared 纯逻辑和现有 API，维持 desktop state refresh 频率和错误处理语义。
- 迁移 wake 页标题、步骤、多语言和重试控件；保持自动唤起时机与协议 URL 不变。
- 按浏览器 popup 的真实尺寸和字体检查溢出、弹层定位、滚动、焦点回收、键盘操作和加载/错误状态。
- shadcn/Radix popup 控件与桌面可共享组件仅共享基础语义与 token，不共享不适合 popup 的页面框架。

**验证与退出条件**：Chrome/Edge popup 构建和交互通过；已登录/未登录/桌面未运行/令牌过期/桥接失败/TOTP/复制等状态有检查；wake 页可打开并触发桌面协议唤起；Popup 不因 React bundle 超出浏览器扩展预算或失去限制在扩展 origin 的执行环境。

### TASK-UIR-07：扩展集成、content-script 与桌面桥接回归

**上下文简报**：content script 不使用 React，但受到 shared locale/theme 去耦、扩展产物 chunk 和 popup 消息调用的影响；必须验证真实页面环境，避免只靠 popup 单测。

**变更边界**：扩展构建产物、popup/background/content 消息接口和桌面唤起集成验证；不改网页匹配算法与扩展权限。

**执行项**：

- 确认 MV3 manifest、service worker、content script、web accessible resources、popup 与 wake 产物路径不变。
- 验证登录后对匹配网站的自动填充、多个候选账号选择、TOTP/验证码、快速保存、内容脚本 toast 和页面注入生命周期。
- 验证 Chrome 与 Edge 的扩展安装/重载流程、浏览器重启后的 session 行为和 desktop bridge unavailable/available 两种路径。
- 检查 React 与 CSS 是否泄漏到宿主页；content UI 若仍使用 DOM API，应验证 escaping、事件清理和样式隔离保持原实现行为。

**验证与退出条件**：通过打包 zip 安装到 Chrome/Edge 的关键旅程；无 React runtime 被 content script 注入；协议、消息 action、manifest 权限及自动填充行为与 TASK-UIR-01 基线一致；任何跨浏览器差异有缺陷记录和处理结论。

### TASK-UIR-08：移除 Vue、统一依赖与构建收口

**上下文简报**：只有桌面、popup、wake UI 全部迁移且 shared 模块不依赖 Vue 后才能删除旧框架。此任务不能提前运行，以免已有页面入口失效。

**变更边界**：两个模块的 package manifests、Vite/electron-vite 配置、TS 配置、入口与锁文件；不得更改业务代码语义或发布版本号。

**执行项**：

- 移除 desktop 的 Vue、Vue Router、Pinia、Element Plus、Vue icons、Vue Vite 插件和 vue-tsc，并配置 `tsc`/React 类型检查脚本。
- 移除 extension 的 Vue、Pinia、Vue Vite 插件和 vue-tsc，调整 React 类型检查及构建脚本。
- 以 pnpm 更新锁文件，删除 npm lockfiles；验证根 `scripts/build-all.mjs` 对 pnpm 子工程命令仍然正确。
- 搜索并清除 UI 入口、业务模块与配置中的 Vue SFC、Vue 指令和 Vue runtime 引用；允许迁移记录中的历史文字保留。
- 确认 Electron main/preload 与 Chrome background/content 的依赖树无 DOM framework 的不必要 bundle。

**验证与退出条件**：两模块无生产 Vue 依赖和 Vue UI 源码；桌面与扩展 typecheck/build/package 全通过；根级 build entry 可运行；manifest、Electron out 结构、安装包资源列表和扩展 zip 结构满足发布消费端要求。

### TASK-UIR-09：全量质量门禁、人工验收与发布准备

**上下文简报**：React 化涵盖密码与身份凭据操作，按生产安全影响执行完整回归。自动化和代理浏览器检查不能替代真人 UI 签认。

**变更边界**：验证、缺陷修复、文档和发布准备；不在本任务中加入新功能。

**执行项**：

- 运行 desktop/extension typecheck、build、package、相关纯逻辑与组件测试、E2E；记录命令、结果、版本和残余风险。
- 按功能矩阵执行桌面主密码、恢复、创建/编辑/删除/批量、复制清理、自动锁定、备份恢复、主题/语言、托盘快捷键与 extension bridge 回归。
- 在 Chrome/Edge 安装扩展并验证 popup、wake、网页匹配、自动填充和浏览器重启流程。
- 对照原型验收 24 个 desktop 场景，重点覆盖液态玻璃静态回退、暗色/高对比、六色焦点/选中、窄窗口、键盘可达性和 reduced-motion。
- 由真人执行桌面与扩展 UI 验收 Todo，记录视口、操作、观察结果、截图和负责人；代理截图或自动操作不得记为真人验收。
- 输出测试报告、模块人工验收记录、已知问题和发布回滚方案；更新 README 的 pnpm 命令及扩展调试说明。

**验证与退出条件**：P0/P1 安全和用户流程无未接受缺陷；desktop 与 extension 自动化通过；真人验收记录覆盖认证、密码库、扩展 popup 和自动填充；发布/回滚步骤可执行且不破坏用户数据。

## UI 变更清单

| 模块 | 页面/路由和状态 | 对应任务 | 主要自动化 | 真人验收重点 |
| --- | --- | --- | --- | --- |
| 桌面认证 | 初始化、首次使用、解锁、恢复；忙碌/错误/确认 | 03、04 | 表单与验证逻辑、认证 E2E | 密码反馈、步骤清晰度、错误恢复 |
| 桌面工作区 | 概览、密码库、收藏、最近访问、安全中心 | 03、04、05 | 列表交互、复制/筛选/编辑 E2E | 信息密度、双栏阅读、窄窗口 |
| 条目工作流 | 类型选择、登录表单、批量、删除确认 | 05 | 表单校验、类型边界、操作 E2E | 焦点、遮蔽、确认语义 |
| 设置 | 通用、安全、主题、快捷键、备份 | 03、04 | 迁移/主题逻辑、设置交互 | 六色、四主题、暗色与玻璃回退 |
| 扩展 popup | 登录、保险库、TOTP、设置、条目对话框 | 06 | Popup 组件与集成 E2E | 实际 popup 尺寸、滚动、键盘操作 |
| 扩展唤起 | wake 页面与 desktop protocol | 06、07 | 唤起逻辑和消息契约 | 错误提示、重试与回到应用体验 |
| 网页集成 | content script 自动填充、选择、保存 | 02、07 | Chrome/Edge 测试环境 E2E | 宿主页面无样式污染、填充正确 |

测试策略按纯逻辑/React store 单元测试、关键交互组件测试、核心旅程 E2E、真人 UI 验收分层。静态展示组件不单独堆测试；安全和 IPC 契约需有独立验证证据。

## 跨模块验收矩阵

| 领域 | 必须维持的行为 | 通过证据 |
| --- | --- | --- |
| 本地保险库 | 初始化、解锁、恢复、锁定与错误态一致 | 核心逻辑测试 + 桌面 E2E + 真人验收 |
| 敏感信息 | 默认遮蔽；按需显示；复制后按偏好清理；锁定时清空敏感状态 | 行为测试、生命周期审查、真人检查 |
| IPC 与桌面平台 | preload API 名称、参数、返回值和事件保持兼容 | 契约测试、macOS/Windows 冒烟 |
| 托盘/快捷键 | 主题/语言同步、打开/锁定/快速搜索动作保持有效 | 主进程集成测试、桌面人工回归 |
| 主题与设置 | 新偏好持久化；旧主题迁移幂等；tray 同步主题模式 | 映射测试、浅深色与主题矩阵 |
| 扩展桥接 | manifest、消息 action、desktop protocol 和存储格式保持兼容 | 构建产物审查、Chrome/Edge 集成 |
| 自动填充 | 站点匹配、字段映射、候选选择与提交时机不变 | 真实测试站点 E2E、浏览器人工验收 |
| 可访问性 | 键盘可达、焦点可见、对话框语义、reduced-motion/transparency | 自动化 a11y 辅助 + 真人键盘检查 |

## 交付批次与回滚

建议按下列可独立审查的提交/PR 批次执行：

1. 基线和迁移契约、shared 逻辑解耦及测试。
2. 桌面 React 入口、设计 token、主题桥接和基础控件。
3. 桌面认证/设置/概览页面。
4. 桌面密码库与条目工作流。
5. 扩展 popup/wake React 入口和页面。
6. Vue 依赖移除、pnpm 锁文件、构建与发布产物收口。
7. 跨端 E2E、真人验收、测试报告与发布准备。

在迁移中间阶段，保留独立可回退的提交边界。出现阻塞时优先回退当前 UI 批次，保持旧 renderer 可构建；不得通过改变用户配置键、加密数据或 IPC 消息来临时规避 UI 问题。删除 Vue 入口前要求 React 页面全量完成且有人工验证；删除依赖后如需回滚，应回退整个依赖清理批次，不单独复制旧锁文件内容。

发布前为新主题配置与扩展版本行为准备可重复的升级验证。配置迁移必须幂等且不覆盖已有新偏好；扩展发布包必须可在 Chrome/Edge 重新安装/升级并保留现有浏览器存储数据。

## 预计阶段状态

| 阶段 | 状态 | 退出条件 |
| --- | --- | --- |
| 迁移契约 | 已完成（代码基线） | [TASK-UIR-01 基线契约记录](task-ui-refactor-01-baseline-contract.md)；接口、消息、偏好、安全时序和构建基线已盘点。真实应用旅程与真人 UI 验收留在全量验收阶段 |
| Shared 去框架化 | 已完成 | extension shared locale、desktop theme/locale utilities 与 vault transforms 不再依赖 Vue/Pinia；系统偏好用显式订阅，解锁上下文经 API adapter 显式传递；行为测试及两端 typecheck/build 通过 |
| React 基础 | 已完成 | 桌面 renderer、扩展 popup/wake React 入口及错误边界可生产构建；共享语义 token 覆盖四主题、六强调色、明暗模式和 reduced-motion/transparency；preload 调用经 typed adapter；生产构建兼容性已验证，详见 [TASK-UIR-03 开发记录](task-ui-refactor-03-development-report.md) |
| 桌面页面迁移 | TASK-UIR-04、05 开发完成；人工旅程待 TASK-UIR-09 | 认证、设置、外观、概览及密码库/关键工作流 React 页面已接入桌面默认入口；开发和自动验证记录见 [TASK-UIR-04 开发记录](task-ui-refactor-04-development-report.md) 与 [TASK-UIR-05 开发记录](task-ui-refactor-05-development-report.md) |
| 扩展 UI 迁移 | TASK-UIR-06 页面开发完成；TASK-UIR-07 Chromium 基本集成回归完成，Edge/完整旅程待 TASK-UIR-09 | popup 默认 React、wake 页面 React 化；production package、content script 依赖边界与 zip 归档检查通过。ego lite Chromium 已安装扩展，真实桌面 bridge、临时凭据匹配/自动填充/删除和运行中桌面 focus 唤起通过；Edge、协议冷启动、TOTP、快速保存和重启 session 留待 TASK-UIR-09。详见 [TASK-UIR-07 开发记录](task-ui-refactor-07-development-report.md) |
| 依赖清理 | TASK-UIR-08 代码、构建收口及 macOS arm64 app/DMG 资源验证完成；当前机器旧 Electron 缓存需刷新，Windows installer 待补验 | 两端 Vue/Pinia/Element Plus/Vue Router 运行时与旧页面已删除，pnpm lockfile/typecheck/build 通过；扩展 package 和根级 build entry 通过。macOS app/DMG 使用隔离新下载缓存经默认 `unpack-electron` 打包并检查；当前用户缓存 ZIP 有异常偏移，Windows installer 待 Windows 环境验证。详情见 [TASK-UIR-08 开发记录](task-ui-refactor-08-development-report.md) |
| 全量验收 | 现有自动化及构建检查通过；未发现 E2E runner，真人验收、Edge 和 Windows installer 待验证，发布门禁 HOLD | [TASK-UIR-09 测试报告](task-ui-refactor-09-development-report.md)、[人工验收记录](task-ui-refactor-09-manual-acceptance.md)、[发布准备与回滚](task-ui-refactor-09-release-readiness.md)。当前 ego lite popup 显示 desktop 未连接；不构成桌面认证或自动填充验收。macOS arm64 app/DMG 在隔离输出目录生成并验证 |

## 风险与未决问题

| 风险/问题 | 影响 | 处理方式 | 进入条件 |
| --- | --- | --- | --- |
| 现有 design proposal 未给出正式 REQ/UX 编号 | 追溯依赖文档章节 | TASK-UIR-01 已在基线契约记录建立 UIR-REQ/UX 迁移追溯编号；正式产品需求编号仍可在需求评审统一治理 | 已记录，后续按需回填 |
| Sass legacy API 与扩展图标重复输出提示 | 构建链升级或产物维护时需处理 | TASK-UIR-03 的两端生产构建已通过；提示与验证结果见 [开发记录](task-ui-refactor-03-development-report.md) | 依赖清理和发布产物收口时 |
| 桌面 Vault 页面规模大且有大量集成行为 | 迁移遗漏或安全回归 | 分组件迁移，保留 IPC/store adapter，按模块验收 | 进入 TASK-UIR-05 前 |
| 主题模型改变旧 `theme` 配置语义 | 升级后用户外观变化 | TASK-UIR-03 已以幂等迁移测试确认保留原明暗感知；具体页面验收仍在各 UI 迁移任务进行 | 页面接入 React 主题时 |
| 扩展 popup 和网页内容脚本共享部分状态/locale 逻辑 | 误把 UI runtime 打入网页 | TASK-UIR-02 已去耦；TASK-UIR-06 生产产物检查确认 React primitives 只由 popup/wake React 入口加载，content script 仅加载 locale、匹配、复制和协议工具 | TASK-UIR-07 在 Chrome/Edge 安装后复核宿主页行为 |
| Element Plus 与 shadcn 同时存在可能造成视觉和可访问性漂移 | 页面体验不统一 | TASK-UIR-08 已移除 Element Plus 与 Vue 页面，桌面默认 renderer 仅构建 React UI | 已关闭；剩余 UI 体验按 TASK-UIR-09 验收 |
| 浏览器扩展在 Chrome 与 Edge 的弹窗和宿主页面行为有差异 | 自动填充或 popup 溢出 | TASK-UIR-07 已完成 Chromium 基本集成；TASK-UIR-09 ego lite 检查确认扩展重载后 Service Worker 有效，但 desktop 未连接；真人签认、Edge 和协议冷启动仍待验证，详见 [验收记录](task-ui-refactor-09-manual-acceptance.md) | TASK-UIR-09 |
| EasyUI/21st.dev 单项组件的依赖、许可和源码质量不同 | 维护与安全风险 | 每个采纳组件记录来源、许可证、依赖、改造点；未审查不合入 | 每次引入组件前 |

明确决定：桌面 renderer 和扩展 popup/wake 迁移 React；Electron main/preload、background/content scripts 保持原技术职责；扩展无需 React 注入网页。实现中需要重新确认的版本/插件兼容性属于工程验证项，不改变已确认迁移方向。

## 证据与追溯

- 设计输入：[docs/design-proposal.md](../design-proposal.md)
- 全页面原型：[docs/prototypes/all-pages.html](../prototypes/all-pages.html)
- 密码库独立原型：[docs/prototypes/bearpassword-vault-concept.html](../prototypes/bearpassword-vault-concept.html)
- 当前桌面入口：[bear-password-desktop/electron.vite.config.ts](../../bear-password-desktop/electron.vite.config.ts)
- 当前扩展构建：[bear-password-extension/vite.config.ts](../../bear-password-extension/vite.config.ts)
- 当前扩展 manifest：[bear-password-extension/manifest.config.ts](../../bear-password-extension/manifest.config.ts)
- 现有主题迁移规则：[docs/design-proposal.md](../design-proposal.md#旧主题配置迁移)
- 安全检查证据、执行命令及人工验收记录见各任务开发报告和 [TASK-UIR-09 测试报告](task-ui-refactor-09-development-report.md)、[人工验收记录](task-ui-refactor-09-manual-acceptance.md)、[发布准备与回滚](task-ui-refactor-09-release-readiness.md)。

## 变更记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| 1.0 | 2026-11-07 | 初版：依据 UI 改版方案、全页面原型及 desktop/extension 当前结构拆分 React 迁移任务。 |
| 1.1 | 2026-11-08 | 记录 TASK-UIR-08 产物验证及 TASK-UIR-09 自动化状态、真人与跨平台待验收项。 |
| 1.2 | 2026-11-08 | 记录 TASK-UIR-09 当前自动化、依赖审计和 macOS 产物证据；人工验收与 Windows/Edge 门禁保持待执行。 |

## 门禁记录

| 检查项 | 当前结论 | 证据/后续动作 |
| --- | --- | --- |
| 设计方案与原型输入已核对 | 通过 | `docs/design-proposal.md` 与 `docs/prototypes/all-pages.html` |
| 桌面及扩展入口已核对 | 通过 | `electron.vite.config.ts`、扩展 `vite.config.ts` 和 `manifest.config.ts` |
| 任务覆盖迁移、主题、安全与扩展回归 | 通过（基线已补） | UIR-REQ/UX 迁移追溯编号与接口/安全/构建基线见 [TASK-UIR-01 契约记录](task-ui-refactor-01-baseline-contract.md)；正式产品需求编号可在后续需求治理中统一补充 |
| React 插件版本兼容性 | 通过 | TASK-UIR-03 桌面 renderer 与扩展 popup/wake 生产构建均通过，版本记录及剩余构建提示见 [开发记录](task-ui-refactor-03-development-report.md) |
| 开发入口门禁 | 历史状态待维护者评审 | TASK-UIR-01 基线已完成，记录见 [基线契约](task-ui-refactor-01-baseline-contract.md)；本计划原 draft 评审门禁需维护者治理确认，不影响已完成任务的代码记录 |
| TASK-UIR-09 自动化、审计及 macOS 产物 | 通过 | Desktop/extension typecheck、build、相关测试、pnpm audit 和扩展 ZIP 检查通过；macOS arm64 app/DMG 隔离生成并核对。命令及限制见 [测试报告](task-ui-refactor-09-development-report.md) |
| TASK-UIR-09 真人与跨平台验收 | 未通过 / HOLD | 桌面及扩展核心旅程待维护者签认；Edge 与 Windows installer 待相应环境验证。执行表见 [人工验收记录](task-ui-refactor-09-manual-acceptance.md) |
