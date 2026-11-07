<p align="center">
  <img src="bear-password-desktop/src/assets/logo.png" alt="BearPassword" width="96" height="96" />
</p>

<h1 align="center">BearPassword 本地版</h1>

<p align="center">
  仅桌面端，无服务器、无账号。保险库数据保存在本机并加密。<br />
  浏览器扩展通过本机桥接连接已解锁的桌面端。
</p>

## 项目范围

- 桌面端：保险库、收藏、最近访问、搜索、条目内 TOTP、自动锁定和剪贴板清理。
- 浏览器扩展：连接已解锁的桌面端，辅助填写网页登录信息。
- 本地版面向全新创建，不支持旧版数据迁移。

## 开发环境

- Node.js 18 或更新版本
- pnpm

安装桌面端依赖并启动开发模式：

```bash
cd bear-password-desktop
pnpm install
pnpm run dev
```

安装扩展依赖并启动开发模式：

```bash
cd bear-password-extension
pnpm install
pnpm run dev
```

## 构建

在仓库根目录运行：

```bash
pnpm run build:all
pnpm run build:mac
pnpm run build:win
pnpm run build:extension
```

桌面端开发检查：

```bash
cd bear-password-desktop
pnpm run typecheck
pnpm run build
```

打包产物输出到仓库根目录的 `release/`。网页端、服务端和官网不属于本地版仓库。

## 安全说明

- 主密码和保险库数据保存在本机；本地版不连接云端服务。
- 扩展只从已解锁的桌面端读取条目，不单独保存主密码或条目明文。
- 生物识别仅用于本机快捷解锁，不能替代手机令牌验证。

## 许可证

MIT · 作者：薛伟同学
