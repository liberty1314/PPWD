# TASK-UIR-03 开发记录：React 基础设施、设计 token 与主题

## 结论

TASK-UIR-03 工程基础已完成。桌面 renderer、扩展 popup 和 wake 页面可以构建 React 入口；Electron main/preload、扩展 background/content 的职责和原入口保持不变。桌面和 popup 默认仍使用 Vue，React foundation 通过 `?ui=react-foundation` 显式启用，供后续页面迁移逐步接管。

## 实施范围

- desktop 配置 React/Vue 双插件、React Router、Zustand、Radix 控件原语、Tailwind/PostCSS 和错误边界；renderer 默认入口按 query 参数选择 React 或 Vue。
- extension 保留 CRXJS、manifest v3 和 Vue 插件，新增 React popup/wake 入口；popup 仅在 foundation query 下切换，wake 页使用 React 并保留自动唤起和原 protocol URL。
- 新增 shared 语义 CSS token，包含四种主题设计、系统/浅色/深色模式、六种强调色、敏感内容不透明底色、液态材质降级，以及 reduced-transparency/reduced-motion 处理。液态材质已应用于 foundation 外壳。
- 新增 React theme stores，迁移旧主题值时保留原明暗偏好；桌面 tray appearance snapshot 继续同步 locale/font，preload 访问经 desktop adapter 收口，包括系统外观、窗口操作、tray command 和锁定快捷键。
- 新增 Button、field/select、dialog、menu、toast、错误边界等基础控件，桌面和 popup 各自保留适合宿主尺寸的外壳。

## 验证

| 检查 | 结果 |
| --- | --- |
| desktop `pnpm run typecheck` | 通过 |
| desktop `pnpm run build` | 通过，renderer/main/preload 均产出；React 与 Vue chunk 均保留 |
| desktop `pnpm run test:theme-migration` | 3 项通过 |
| extension `pnpm run typecheck` | 通过 |
| extension `pnpm run build` | 通过，popup/wake/background/content 入口均由 Vite/CRXJS 构建 |
| extension `pnpm run test:locale` | 3 项通过 |
| 默认入口及 wake 延时核对 | 通过；renderer/popup 默认 Vue，显式 query 才进入 React；wake 自动唤起延时为 300ms |
| `git diff --check` | 通过 |
| ego lite popup 检查 | 360×600 尺寸下控件可见且无横向溢出 |

## 已知提示

- 桌面生产构建报告 Dart Sass legacy JS API 弃用，来源于现有 Sass 构建链。
- 扩展构建提示 4 个 `public/icons/icon-*.png` 输出重名，现有资源仍正常写入；该提示需在后续构建产物收口任务处理。
- Node 对 strip-types 测试文件提示 package module type 未声明；测试通过，不影响构建。

## 后续边界

本任务只建立 React foundation 与主题演示，不迁移桌面认证、设置、概览、密码库，也不迁移 popup 的登录和保险库业务流程。实际用户业务仍在原 Vue 页面，后续按 TASK-UIR-04 至 TASK-UIR-07 迁移并验收。
