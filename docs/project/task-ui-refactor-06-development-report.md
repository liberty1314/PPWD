# TASK-UIR-06 开发记录：扩展 popup 与 wake 页面 React 化

## 结论

扩展 popup 默认入口已迁入 React，wake 页面也使用 React renderer；扩展 manifest、权限、Chrome storage schema、background 消息和桌面协议 URL 未变。构建、locale 测试及 ego lite 中的浏览器 API mock 交互检查通过。真实 Chrome/Edge 安装、真实桌面 bridge/协议唤起与网页自动填充回归留待 TASK-UIR-07、09，不计为已通过。

## 实施范围

- 新增 popup React 页面及 Zustand store，承接桌面连接状态、登录/锁定提示、凭据搜索、当前网站匹配、复制与自动填充、TOTP、条目增改/分享/收藏/删除、设置和刷新操作。
- 新增 popup theme/locale stores；主题与语言继续读取并订阅桌面端偏好。保留 `?ui=vue` 临时回退路径，默认 popup 入口加载 React。
- 新增 wake React 页面，保留自动尝试桌面协议唤起的时机及手动重试；文案沿用现有多语言资源。
- 为异步桌面状态和保险库请求增加请求序号保护，避免锁定后迟到的响应恢复敏感凭据或覆盖较新的状态。
- 保留 Radix 弹层交互和浏览器已有消息/API 调用契约；没有修改 manifest 权限、storage schema、background/content 消息或网页 content script UI。

## 验证

| 检查 | 结果 |
| --- | --- |
| extension `pnpm run build`（含 `vue-tsc --noEmit`） | 通过；popup、wake 和扩展脚本产物正常生成 |
| `pnpm run test:locale` | 3 项通过 |
| ego lite + Chrome API mock | 检查凭据列表、创建保存反馈、删除确认、搜索空态、设置页、wake 自动尝试及手动重试；没有实际唤起桌面应用 |
| popup 尺寸与溢出 | mock 页面主体宽度 380px，检查未发现横向溢出 |
| 生产 bundle 检查 | React primitives chunk 由 popup/wake React renderer 引用；MV3 content script loader 指向既有内容脚本 bundle，其依赖为 locale、网站匹配、复制和桌面协议工具，未发现 React runtime 泄漏 |
| manifest 与入口路径 | `src/popup/index.html`、`src/wake/index.html`、service worker 和 content script 路径及权限保持原值 |
| `git diff --check` | 通过 |

构建提示 `public/icons/*` 图标被重复输出覆盖；产物仍成功生成。旧 Vue popup 代码及依赖保留为临时回退，由 TASK-UIR-08 统一清理。

## 验收限制与后续

本任务没有在真实 Chrome/Edge 中安装扩展，也没有连接运行中的桌面应用。因此桌面未运行/令牌过期/bridge 失败等真实错误路径、协议唤起、自动填充、TOTP 与剪贴板实际行为、浏览器重启后的 session 行为尚未完成集成验收。TASK-UIR-07/09 需完成真实浏览器关键旅程，并核对 popup 键盘焦点、弹层定位与限制在扩展 origin 的执行环境；mock 检查不替代这些验收。
