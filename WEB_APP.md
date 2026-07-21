# ItemLocker / 上科大失物招领 Web/PWA 版本

`web/` 是当前唯一维护主线。它不依赖微信小程序审核，可以直接部署成网页，并支持从手机浏览器安装到桌面。

## 本地运行

```bash
cd web
npm install
npm run dev
```

打开终端输出的本地地址，例如：

```text
http://localhost:5174
```

## 生产构建

```bash
cd web
npm run build
```

构建产物会生成在 `web/dist/`，可以部署到静态网站服务，例如 Vercel、Netlify、GitHub Pages、腾讯云静态网站托管或任意 Nginx。

## 网页端混元图像识别

网页端必须通过服务端调用混元大模型，不能把模型服务凭据写进浏览器代码。当前前端优先调用 CloudBase `lostfound` 云函数：

```bash
VITE_TCB_FUNCTION_NAME=lostfound
VITE_TCB_REGION=ap-shanghai
```

可以复制 `web/.env.production.example` 为 `web/.env.production`。公开仓库只保留非敏感运行配置；凭据类值只能放在 CloudBase 或部署平台的 secret storage。

前端与云函数的调用约定：

```js
{
  action: 'classifyImage',
  imageBase64,
  mimeType: 'image/jpeg',
  hint
}
```

云函数会在服务端读取模型服务凭据，再调用腾讯混元视觉模型。上线前需要在 CloudBase 控制台开启 Web 端可调用云函数的权限，并按腾讯 CloudBase Web SDK 要求配置对应权限策略。

如果不走 CloudBase，也可以部署 `web/api/classify-image.js` 作为独立后端代理，前端会读取：

```bash
VITE_MODEL_API_URL=https://你的后端域名/api/classify-image
```

`web/api/classify-image.js` 提供了一个 Vercel 风格的服务端接口模板。服务端凭据、代理访问凭据和来源白名单必须通过部署平台 secret storage 配置，不写入仓库。

部署后，图片上传会调用该接口，再由服务端调用腾讯混元视觉模型返回分类、标签和物品描述。网页不会再使用浏览器本地模型伪装成自动识别。

### lockmyitem.asia 上线检查

1. `lostfound` 云函数部署最新代码，且 `classifyImage` action 可用。
2. 云函数已在 CloudBase 控制台配置模型服务凭据。
3. 邮箱登录或通知启用时，已在 CloudBase 控制台配置邮件服务凭据和 auth 签名 secret。
4. CloudBase Web 端权限二选一：
   - 开启匿名登录，让前端用匿名身份调用云函数。
   - 配置 Web Publishable 权限并在部署平台 secret storage 中设置对应凭据。
5. 将 `https://lockmyitem.asia` 加入 CloudBase Web 安全来源或允许来源。
6. 构建并部署网页端：

```bash
cd web
npm install
npm run build
```

目标返回字段包括：`category`、`aiTags`、`visualDescription`、`yoloObjects`、`semanticTags`、`modelSources`。

## 手机浏览器安装

部署到 HTTPS 域名后，用手机浏览器打开网页：

- Android Chrome/Edge：点击页面右上角“安装”，或浏览器菜单里的“安装应用/添加到主屏幕”。
- iPhone Safari：点击分享按钮，然后选择“添加到主屏幕”。

这种方式是 PWA，不需要应用商店审核，适合先给同学扫码或浏览器访问使用。

## 后续打包成手机 App

如果后续确实需要 APK，可以继续基于 `web/` 做两条路线：

- Capacitor：把同一套 React 页面包装成 Android 项目，生成 APK。
- TWA：如果 PWA 已经部署到 HTTPS 域名，可以用 Trusted Web Activity 生成更轻的 Android 包。

当前版本已经具备 PWA 必需文件：

- `web/public/manifest.webmanifest`
- `web/public/sw.js`
- `web/public/icon.svg`

## 当前网页功能

- 失物招领、寻物、已找回三类列表
- 分类与关键词筛选
- 校园地图标记
- 发布招领/寻物
- 图片识别、分类与相似匹配
- 详情页、评论、认领、标记已找回
- 邮箱登录、昵称维护、我的发布与浏览器安装入口

网页端数据优先通过 CloudBase 调用 `lostfound` 云函数的 `listItems`、`createItem`、`getItemDetail`、`createComment`、`markReturned` 和 `undoReturned` action；浏览器 `localStorage` 仅作为加载失败或离线时的缓存兜底。
