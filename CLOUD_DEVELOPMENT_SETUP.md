# CloudBase Backend Setup

CloudBase environment:

```text
cloud1-d9gnyuxf5b44b6b92
```

The web app calls `cloudfunctions/lostfound` through the CloudBase Web SDK. This function handles item data, comments, email auth, claim/return flows, match notifications, and Hunyuan image recognition.

## Web Environment Variables

Configure these values for the web build or copy `web/.env.production.example` to a local production env file:

```env
VITE_CLOUDBASE_ENV_ID=cloud1-d9gnyuxf5b44b6b92
VITE_CLOUDBASE_FUNCTION_NAME=lostfound
VITE_CLOUDBASE_REGION=ap-shanghai
VITE_CLOUDBASE_ACCESS_KEY=
```

Leave `VITE_CLOUDBASE_ACCESS_KEY` empty only when anonymous login is enabled for this CloudBase environment.

## Cloud Function Environment Variables

Configure these variables in the CloudBase console for `cloudfunctions/lostfound`.

Tencent Cloud signed Hunyuan mode:

```env
TENCENT_SECRET_ID=your-secret-id
TENCENT_SECRET_KEY=your-secret-key
HUNYUAN_MODEL=hunyuan-vision
TENCENT_HUNYUAN_ENDPOINT=https://hunyuan.tencentcloudapi.com
```

Optional OpenAI-compatible Hunyuan mode:

```env
HUNYUAN_API_KEY=your-sk-api-key
HUNYUAN_BASE_URL=https://api.hunyuan.cloud.tencent.com/v1
HUNYUAN_MODEL=hunyuan-vision
```

If both Tencent Cloud `SecretId/SecretKey` and `HUNYUAN_API_KEY` exist, the cloud function prefers Tencent Cloud signed API calls.

Optional ShanghaiTech email login:

```env
AUTH_EMAIL_DOMAIN=shanghaitech.edu.cn
AUTH_TOKEN_SECRET=use-a-long-random-server-side-secret
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-sender@example.com
SMTP_PASS=your-smtp-password-or-app-password
SMTP_FROM=LockMyItem <your-sender@example.com>
```

`AUTH_TOKEN_SECRET` and all SMTP credentials must stay in CloudBase environment variables. Do not put real values in frontend code or GitHub.

## Deploy

Use the CloudBase project configuration in `cloudbaserc.json` and deploy `cloudfunctions/lostfound` with cloud-side dependency installation. The function configuration is:

```text
runtime: Nodejs16.13
handler: index.main
timeout: 30
memorySize: 512
```

The same timeout and memory settings are also recorded in:

```text
cloudfunctions/lostfound/config.json
```

If the CloudBase console reports `FUNCTIONS_TIME_LIMIT_EXCEEDED`, set the `lostfound` timeout to 30 seconds manually and deploy again.

## Test classifyImage

Cloud function test event:

```json
{
  "action": "classifyImage",
  "imageUrl": "https://raw.githubusercontent.com/lockmuitem/lockmyitem/main/web/src/assets/items/umbrella.jpg",
  "hint": "雨伞，校园失物招领图片识别测试"
}
```

Expected shape:

```json
{
  "ok": true,
  "data": {
    "category": "雨伞",
    "aiTags": [],
    "visualDescription": "",
    "yoloObjects": [],
    "semanticTags": [],
    "modelSources": {}
  }
}
```

Do not commit real API keys, SMTP credentials, tokens, cookies, or CloudBase Publishable Keys.
