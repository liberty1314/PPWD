# Repository Guidelines

## 项目结构与模块组织

本仓库是 PPWD 本地版 monorepo。`ppwd-desktop/` 是 Electron + React 桌面端，主进程和 preload 位于 `electron/`，渲染端源码位于 `src/`；`ppwd-extension/` 是 React 浏览器扩展，入口分布在 `src/background`、`src/content`、`src/popup` 和 `src/wake`。根目录 `shared/` 存放桌面端与扩展端共用的 UI 资源。服务端、网页端和官网不在当前仓库中。

## 构建、测试与开发命令

- `cd ppwd-desktop && pnpm install`、`cd ppwd-extension && pnpm install`：分别安装桌面端和扩展端依赖。
- `pnpm run build:all`：从根目录聚合构建桌面端和扩展，产物输出到 `release/`。
- `cd ppwd-desktop && pnpm run dev`、`cd ppwd-extension && pnpm run dev`：启动对应模块的开发模式。
- 在桌面端或扩展端目录执行 `pnpm run typecheck` 和 `pnpm run build`：分别进行类型检查和构建。

## 代码风格与命名约定

TypeScript/TSX 使用 2 空格缩进、单引号、无分号；React 组件文件使用 PascalCase，组合式函数使用 `useXxx.ts`，Zustand store 按业务命名放在 `src/stores`。

## 测试指南

桌面端和扩展端使用 TypeScript 类型检查与 Node 测试。修改加密、保险库、扩展桥接、自动填充等关键逻辑时，运行受影响模块的 `pnpm run typecheck` 和 `pnpm run build`，并执行相关测试脚本。

## 提交与 Pull Request 规范

Git 历史采用 Conventional Commits 风格，如 `feat(web): ...`、`fix: ...`、`build(desktop): ...`、`chore(version): ...`。提交信息建议中文描述具体变更。PR 应包含变更摘要、验证命令、关联 issue；涉及 UI 或安装包流程时附截图或说明影响平台（macOS、Windows、Chrome/Edge）。

## 安全与配置提示

不要提交真实数据库、Redis、邮件或 OSS 密钥。后端本地配置优先放在 `application-dev.yml`，生产环境通过 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD` 等环境变量注入。涉及保险库加密、主密码、TOTP、剪贴板和本机扩展通信的改动需额外说明安全影响。

## Agent 特定说明

保持改动聚焦在目标模块，不要顺手重排生成文件、截图或锁文件。桌面端与扩展端存在相似的独立实现时，优先保持各自模块边界并避免行为漂移。调试扩展时在 `chrome://extensions` 加载 `ppwd-extension/dist`。除发布任务外，不要提交 `release/`、`dist/` 或 `out/` 产物。

<!-- ASTRYX:START -->
Astryx v0.7.11 · 174 components
CLI: run every command as `astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — start every page from a template, never from scratch:
1. `astryx build "<idea>"` — names the template to scaffold from and the parts it lacks.
2. `astryx template <name> <path>` — scaffold it; keep its frame, gap and padding; replace the content.
3. `astryx template <Block>` for parts it lacks; `astryx component <Name>` to read props before using one.
Changing an existing page? Keep it: skip step 2 and add blocks/components inside its sections.

RULES:
- No <div> — components handle all layout and spacing.
- Read `astryx docs layout` before changing a template's frame.
- Dense data = rows (Table, List/Item), not Card-wrapped lists. Badge = counts only.
- Style with component props first, then tokens (var(--color-*|--spacing-*|--radius-*)). No raw hex/px. No StyleX/Tailwind compiler here — don't use xstyle/utility classes directly. Some templates use StyleX and need a compiler plugin; see `astryx docs styling-overview`.
- Palettes and custom colors go through the theme, never :root overrides. Run `astryx theme add <slug>` to import; `theme eject <slug>` only forks source. See `astryx docs theme`.
- SELF-CHECK: re-read the file; replace any raw <div>/<span>, imported .css/@apply, or hardcoded #hex/px with the component or a token.

`astryx help` lists every command. Key ones beyond the workflow:
  search "<query>"   find any component / hook / doc / template
  discover <words>   integrations you could add
  docs <topic>       getting-started, principles, tokens, theme … (`astryx docs` lists all)
  docs cli           commands and API reference
  docs authoring     build an integration package, and every field it holds
  upgrade --from <old version> --apply   run after a dependency bump
<!-- ASTRYX:END -->
