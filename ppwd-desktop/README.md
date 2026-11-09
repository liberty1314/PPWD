<p align="center">
  <img src="src/assets/logo.png" alt="PPWD" width="80" height="80" />
</p>

<h1 align="center">PPWD 本地版桌面端</h1>

<p align="center">在电脑上管理密码库、生成强密码、查看两步验证码的主应用</p>

<p align="center">
  <a href="../README.md">返回项目首页</a>
</p>

---

## 你可以用它做什么

- **保存各类敏感信息**：网站登录、银行卡、身份证信息、服务器与数据库连接、安全备注、独立的两步验证条目等
- **登录条目更丰富**：通过「添加更多」补充 URL、邮箱、地址、电话、备用密码、**两步验证**等字段
- **查看 TOTP 验证码**：在条目详情中实时显示 6 位验证码与倒计时；支持扫码或粘贴密钥导入
- **保护隐私**：主密码与手机令牌保护本地保险库；离开一段时间自动锁定；复制敏感内容后可定时清空剪贴板
- **配合浏览器扩展**：桌面端解锁后，扩展才能在网页中自动填充

<p align="center">
  <img src="../bear-password-index/assets/screenshots/6新增密码.png" alt="新增密码条目" width="640" />
</p>

<p align="center">
  <img src="../bear-password-index/assets/screenshots/10安全设置.png" alt="安全设置" width="640" />
</p>

---

## 下载与安装

从项目发布页获取对应系统安装包：

- **macOS**：`.dmg` 安装包（内含应用与安装说明）
- **Windows**：`PPWD-Setup.exe` 安装程序（安装后注册桌面协议，供浏览器扩展唤醒）

首次启动时创建本地保险库并绑定手机验证器。请妥善保存首次创建时展示的恢复密钥；软件不会替你保存或找回该密钥。

本地版面向全新创建，不读取或迁移旧版本地库、旧账号或旧版导出文件。产品不提供账号找回、多设备同步或云端备份；需要在设备间转移数据时，请使用本版导出的加密备份。

---

## 与浏览器扩展配合

1. 安装 [浏览器扩展](../ppwd-extension/)
2. 保持 PPWD 桌面端**已解锁**
3. 打开需要登录的网站，点击输入框旁的 PPWD 图标进行填充

扩展通过本机安全通道读取数据，无需在浏览器里再次输入主密码。

---

## 从源码运行（开发者）

**要求：** Node.js ≥ 20，pnpm

```bash
pnpm install
pnpm run dev          # 开发模式，自动打开窗口
pnpm run build        # 构建
pnpm run build:mac    # 打包 macOS 安装包
pnpm run build:win    # 打包 Windows 安装包
pnpm run typecheck    # 类型检查
```

打包产物位于仓库根目录 `release/`。

---

## 技术概要

Electron · React · TypeScript · Zustand · Radix UI · Vite

---

## 许可证

MIT · 作者：薛伟同学
